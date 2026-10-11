import { describe, expect, it } from 'vitest'
import type { ProcessPort, ProcessRequest } from '../../io/processPort'
import { fakeProcessPort } from '../../io/testProcessPort'
import { err, ok } from '../../shared/result'
import { toGitBinary } from '../gitBinary'
import { runGit } from '../runGit'

const git = toGitBinary('/fake/git')

function recordingPort(calls: ProcessRequest[]): ProcessPort {
  return fakeProcessPort((request) => {
    calls.push(request)
    return Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from('out') }))
  })
}

describe('runGit', () => {
  it('prepends the safety config and -C before the arguments', async () => {
    const calls: ProcessRequest[] = []
    await runGit({ git, dir: '/repo', args: ['rev-parse', 'HEAD'], port: recordingPort(calls) })
    expect(calls[0]?.file).toBe('/fake/git')
    expect(calls[0]?.args).toEqual([
      '--no-lazy-fetch',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.attributesFile=/dev/null',
      '-c',
      'core.untrackedCache=false',
      '-c',
      'protocol.allow=never',
      '-c',
      'protocol.ext.allow=never',
      '-c',
      'protocol.file.allow=never',
      '-c',
      'protocol.ssh.allow=never',
      '-c',
      'protocol.http.allow=never',
      '-c',
      'protocol.https.allow=never',
      '-c',
      'protocol.git.allow=never',
      '-C',
      '/repo',
      'rev-parse',
      'HEAD'
    ])
  })

  it('passes a scrubbed environment without inherited git variables', async () => {
    const calls: ProcessRequest[] = []
    process.env['GIT_DIR'] = '/elsewhere'
    try {
      await runGit({ git, dir: '/repo', args: ['diff'], port: recordingPort(calls) })
    } finally {
      delete process.env['GIT_DIR']
    }
    const env = calls[0]?.env ?? {}
    expect(env).toMatchObject({
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      GIT_PAGER: 'cat',
      LC_ALL: 'C'
    })
    expect(env).not.toHaveProperty('GIT_DIR')
    expect(env).not.toHaveProperty('GIT_WORK_TREE')
    expect(env).not.toHaveProperty('HOME')
  })

  it('asks for a timeout and a size cap', async () => {
    const calls: ProcessRequest[] = []
    await runGit({ git, dir: '/repo', args: ['diff'], port: recordingPort(calls) })
    expect(calls[0]?.timeoutMs).toBeGreaterThan(0)
    expect(calls[0]?.maxOutputBytes).toBeGreaterThan(0)
  })

  it.each(['status', 'commit', 'checkout', 'config', '-c', '--exec-path', ''])(
    'throws for the unlisted subcommand %j',
    async (subcommand) => {
      await expect(
        runGit({ git, dir: '/repo', args: [subcommand], port: recordingPort([]) })
      ).rejects.toThrow('git-subcommand-not-allowed')
    }
  )

  it.each([
    [['config', 'core.editor', 'vim']],
    [['config', '--get-regexp']],
    [['config', '--global', '--get-regexp', 'x']],
    [['config', '--unset', 'x', 'y']]
  ])('throws for config args %j', async (args) => {
    await expect(runGit({ git, dir: '/repo', args, port: recordingPort([]) })).rejects.toThrow(
      'git-subcommand-not-allowed'
    )
  })

  it('allows the config --get-regexp read form', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['config', '--get-regexp', '^filter\\.'],
      port: recordingPort([])
    })
    expect(result.ok).toBe(true)
  })

  it.each([
    [['diff', '--output=/tmp/x', 'abc']],
    [['diff', '--unknown-flag']],
    [['ls-files', '--others', '--exclude-from=/etc/passwd']],
    [['rev-parse', '--git-dir', 'x']],
    [['merge-base', '-a', 'x', 'y']]
  ])('throws for the flag in %j', async (args) => {
    await expect(runGit({ git, dir: '/repo', args, port: recordingPort([]) })).rejects.toThrow(
      'git-option-not-allowed'
    )
  })

  it('allows the check-attr form with -z, --all, and -- only', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['check-attr', '-z', '--all', '--', 'a.bin', '--stdin'],
      port: recordingPort([])
    })
    expect(result.ok).toBe(true)
  })

  it.each([
    [['check-attr', '--stdin', 'filter']],
    [['check-attr', '--all', '--stdin', '--', 'a.bin']],
    [['check-attr', '--source=HEAD', 'filter', '--', 'a.bin']],
    [['check-attr', '--source', 'HEAD', 'filter', '--', 'a.bin']],
    [['check-attr', '-a', '--', 'a.bin']]
  ])('throws for the check-attr flag in %j', async (args) => {
    await expect(runGit({ git, dir: '/repo', args, port: recordingPort([]) })).rejects.toThrow(
      'git-option-not-allowed'
    )
  })

  it('does not inspect operands after --', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['diff', '--numstat', '--', '--output=x'],
      port: recordingPort([])
    })
    expect(result.ok).toBe(true)
  })

  it('throws for a relative directory', async () => {
    await expect(
      runGit({ git, dir: 'repo', args: ['diff'], port: recordingPort([]) })
    ).rejects.toThrow('git-dir-not-absolute')
  })

  it('throws when there are no arguments', async () => {
    await expect(runGit({ git, dir: '/repo', args: [], port: recordingPort([]) })).rejects.toThrow(
      'git-subcommand-not-allowed'
    )
  })

  it('passes a port failure through unchanged', async () => {
    const result = await runGit({
      git,
      dir: '/repo',
      args: ['diff'],
      port: fakeProcessPort(() => Promise.resolve(err('timeout')))
    })
    expect(result).toEqual({ ok: false, error: 'timeout' })
  })
})
