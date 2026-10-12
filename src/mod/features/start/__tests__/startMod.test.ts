import { describe, expect, it } from 'vitest'
import { fileSystem } from '../../../../core/io/installFileSystem'
import { processPort } from '../../../../core/io/installProcessPort'
import { createTestHost, type TestHostAnswers, type TestPath } from '../../../testHost'
import { FS_READ_LIMIT } from '../../../io/fsReadLimit'
import { startMod } from '../startMod'

const CWD = '/work/repo'

const start = (answers: TestHostAnswers = {}): ReturnType<typeof startMod> =>
  startMod(createTestHost(answers), { cwd: CWD })

describe('startMod version', () => {
  it('is ready on the minimum version', async () => {
    const outcome = await start({ version: { version: '2.1.296' } })

    expect(outcome.kind).toBe('ready')
  })

  it('reports the version when Claude Code is too old', async () => {
    const outcome = await start({ version: { version: '2.1.100' } })

    expect(outcome).toEqual({ kind: 'too-old', version: '2.1.100' })
  })

  it('maps a rejected version call to failed instead of rejecting', async () => {
    const version = (): never => {
      throw new Error('engine unavailable')
    }

    expect(await start({ version })).toEqual({ kind: 'failed' })
  })
})

describe('startMod projects folder', () => {
  it('uses ~/.claude/projects under HOME', async () => {
    expect(await start({ env: { HOME: '/home/u' } })).toEqual({
      kind: 'ready',
      projectsRoot: '/home/u/.claude/projects',
      gitDisabled: false
    })
  })

  it('prefers CLAUDE_CONFIG_DIR over HOME', async () => {
    const outcome = await start({ env: { HOME: '/home/u', CLAUDE_CONFIG_DIR: '/cfg' } })

    expect(outcome).toMatchObject({ kind: 'ready', projectsRoot: '/cfg/projects' })
  })

  it('falls back to HOME when CLAUDE_CONFIG_DIR is empty', async () => {
    const outcome = await start({ env: { HOME: '/home/u', CLAUDE_CONFIG_DIR: '' } })

    expect(outcome).toMatchObject({ projectsRoot: '/home/u/.claude/projects' })
  })

  it('fails with neither variable set', async () => {
    expect(await start({ env: {} })).toEqual({ kind: 'failed' })
  })

  it('fails when the folder would be relative', async () => {
    expect(await start({ env: { HOME: 'relative' } })).toEqual({ kind: 'failed' })
  })

  it('uses the real path of the folder', async () => {
    const outcome = await start({
      paths: {
        '/home/u/.claude/projects': { kind: 'dir', isLink: true, realPath: '/data/projects' }
      }
    })

    expect(outcome).toMatchObject({ projectsRoot: '/data/projects' })
  })

  it('is still ready when the folder does not exist, with the unresolved path', async () => {
    const outcome = await start()

    expect(outcome).toMatchObject({ kind: 'ready', projectsRoot: '/home/u/.claude/projects' })
  })

  it('fails when the folder cannot be examined for another reason', async () => {
    const eacces = Object.assign(new Error('denied'), { code: 'EACCES' })

    expect(await start({ failures: { '/home/u/.claude/projects': eacces } })).toEqual({
      kind: 'failed'
    })
  })
})

describe('startMod installs the ports', () => {
  it('installs a file system that resolves against the session directory', async () => {
    await start()

    expect(fileSystem().resolvePath('x')).toBe('/work/repo/x')
  })

  it('installs a process port that names the platform uname reports', async () => {
    await start({ os: 'Linux\n' })

    expect(processPort().platform).toBe('linux')
  })

  it('assumes darwin when uname fails', async () => {
    const os = (): never => {
      throw new Error('no uname')
    }

    expect(await start({ os })).toMatchObject({ kind: 'ready' })
    expect(processPort().platform).toBe('darwin')
  })

  it('refuses git, and says so, when a git repository variable is set', async () => {
    const outcome = await start({ gitRepoVariables: ['GIT_DIR'] })

    expect(outcome).toMatchObject({ kind: 'ready', gitDisabled: true })
    expect(
      await processPort().run({
        file: '/usr/bin/git',
        args: ['status'],
        env: {},
        timeoutMs: 1000,
        maxOutputBytes: 100
      })
    ).toEqual({ ok: false, error: 'spawn-failed' })
  })

  it('resolves a projects folder that appears behind a link after startup', async () => {
    const big = '/data/projects/p/s.jsonl'
    const paths: Record<string, TestPath> = {
      [big]: { kind: 'file', bytes: new TextEncoder().encode('abcdefgh'), size: FS_READ_LIMIT + 1 }
    }
    await start({ paths })
    paths['/home/u/.claude/projects'] = { kind: 'dir', isLink: true, realPath: '/data/projects' }

    let text = ''
    for await (const chunk of fileSystem().readChunks(big, { start: 0 })) {
      text += new TextDecoder().decode(chunk)
    }

    expect(text).toBe('abcdefgh')
  })

  it('lets git run when no repository variable is set', async () => {
    const outcome = await start()

    expect(outcome).toMatchObject({ gitDisabled: false })
    const result = await processPort().run({
      file: '/usr/bin/git',
      args: ['status'],
      env: {},
      timeoutMs: 1000,
      maxOutputBytes: 100
    })
    expect(result.ok).toBe(true)
  })
})
