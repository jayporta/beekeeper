import { describe, expect, it } from 'vitest'
import { t } from '../i18n/modI18n'
import { hostOf, register } from '../register'
import { createTestEngine, type TestEngineAnswers } from '../testEngine'
import { createNext } from '../testNext'
import { recordingOn } from '../testOn'

/** Runs the registered session.start hook against a fake `$` and returns the calls it made. */
async function startSession(
  answers: TestEngineAnswers,
  { isInteractive }: { isInteractive: boolean }
): Promise<ReturnType<typeof createTestEngine>['calls']> {
  const { on, registered } = recordingOn()
  register(on, {})
  const start = registered.find((entry) => entry.event === 'session.start')
  const { $, calls } = createTestEngine(answers)
  const { next } = createNext({ cwd: '/work' })
  await start?.hook($, { cwd: '/work', surface: 'terminal', isInteractive }, next)
  return calls.filter((call) => call.name === 'command.register' || call.name === 'ui.status')
}

describe('register', () => {
  it('registers session.start, the beekeeper command and the Pane render', () => {
    const { on, registered } = recordingOn()

    register(on, {})

    expect(registered.map(({ event, matcher }) => ({ event, matcher }))).toEqual([
      { event: 'session.start', matcher: undefined },
      { event: 'command.run', matcher: { command: 'beekeeper' } },
      { event: 'ui.render', matcher: { component: 'Pane', requestId: 'beekeeper' } }
    ])
  })

  it('opens the beekeeper pane and replies with one line when /beekeeper runs', async () => {
    const { on, registered } = recordingOn()
    register(on, {})
    const command = registered.find((entry) => entry.event === 'command.run')
    const { $, calls } = createTestEngine()

    const reply = await (command?.hook as unknown as (engine: typeof $) => Promise<unknown>)($)

    expect(calls).toEqual([
      {
        name: 'ui.open',
        args: [{ id: 'beekeeper', title: 'beekeeper', focus: true, closeOnEscape: true }]
      }
    ])
    expect(reply).toEqual({ text: t('command.opened') })
  })

  it('says the pane is open but not shown when the engine does not place it', async () => {
    const { on, registered } = recordingOn()
    register(on, {})
    const command = registered.find((entry) => entry.event === 'command.run')
    const { $ } = createTestEngine({ isPlaced: false })

    const reply = await (command?.hook as unknown as (engine: typeof $) => Promise<unknown>)($)

    expect(reply).toEqual({ text: t('command.waiting') })
    expect(t('command.waiting')).toBe("beekeeper pane is open but can't be shown here yet.")
  })

  it('answers the host version call with the engine version', async () => {
    const { $, calls } = createTestEngine({ version: { version: '2.1.300' } })

    const version = await hostOf($).version()

    expect(version).toEqual({ version: '2.1.300' })
    expect(calls).toEqual([{ name: 'session.version', args: [] }])
  })

  describe('hostOf', () => {
    it('lists a directory through $.fs.list', async () => {
      const { $, calls } = createTestEngine()

      const entries = await hostOf($).list('/d')

      expect(entries).toEqual([])
      expect(calls).toEqual([{ name: 'fs.list', args: ['/d'] }])
    })

    it('stats a path through $.fs.stat and resolves links', async () => {
      const { $, calls } = createTestEngine()

      await hostOf($).stat('/p')

      expect(calls).toEqual([{ name: 'fs.stat', args: ['/p', { resolve: true }] }])
    })

    it('spawns tail one byte past the offset, because tail counts from 1', async () => {
      const { $, calls } = createTestEngine()

      await hostOf($).tail('/abs/file', 5).next()

      expect(calls).toEqual([
        { name: 'process.spawn', args: [{ argv: ['tail', '-c', '+6', '/abs/file'] }] }
      ])
    })

    it.each([
      ['a negative start', '/abs/file', -1],
      ['a fractional start', '/abs/file', 1.5],
      ['an unsafe start', '/abs/file', Number.MAX_SAFE_INTEGER + 1],
      ['a relative path', 'file', 0],
      ['a path that looks like an option', '-f', 0]
    ])('refuses %s before any spawn', (_name, path, start) => {
      const { $, calls } = createTestEngine()

      expect(() => hostOf($).tail(path, start)).toThrow()
      expect(calls).toEqual([])
    })

    it('runs git by absolute path through $.process.run with the env and timeout', async () => {
      const { $, calls } = createTestEngine()

      const result = await hostOf($).runGit({
        file: '/usr/bin/git',
        args: ['status'],
        env: { A: 'b' },
        timeoutMs: 1000
      })

      expect(result.exitCode).toBe(0)
      expect(calls).toEqual([
        {
          name: 'process.run',
          args: [['/usr/bin/git', 'status'], { env: { A: 'b' }, timeoutMs: 1000 }]
        }
      ])
    })

    it.each([
      ['another program', '/usr/bin/curl', ['https://example.com']],
      ['git by relative path', 'git', ['status']]
    ])('refuses to run %s', async (_name, file, args) => {
      const { $, calls } = createTestEngine()

      await expect(hostOf($).runGit({ file, args, env: {}, timeoutMs: 1000 })).rejects.toThrow()
      expect(calls).toEqual([])
    })

    it('asks uname -s for the OS name', async () => {
      const { $, calls } = createTestEngine()

      await hostOf($).osName()

      expect(calls).toEqual([{ name: 'process.run', args: [['uname', '-s'], undefined] }])
    })

    it('reads HOME and CLAUDE_CONFIG_DIR by literal name', async () => {
      const { $, calls } = createTestEngine({ env: { HOME: '/h', CLAUDE_CONFIG_DIR: '/c' } })

      expect(await hostOf($).home()).toBe('/h')
      expect(await hostOf($).configDir()).toBe('/c')
      expect(calls.map((call) => call.args[0])).toEqual(['HOME', 'CLAUDE_CONFIG_DIR'])
    })

    it('names the git repository variables that are set, counting an empty one', async () => {
      const { $ } = createTestEngine({
        env: {
          GIT_DIR: '',
          GIT_NAMESPACE: 'n',
          GIT_ATTR_SOURCE: 'x',
          GIT_REPLACE_REF_BASE: 'y',
          HOME: '/h'
        }
      })

      expect(await hostOf($).gitRepoVariablesSet()).toEqual([
        'GIT_DIR',
        'GIT_NAMESPACE',
        'GIT_ATTR_SOURCE',
        'GIT_REPLACE_REF_BASE'
      ])
    })

    it('names none when no git repository variable is set', async () => {
      const { $, calls } = createTestEngine({ env: { HOME: '/h' } })

      expect(await hostOf($).gitRepoVariablesSet()).toEqual([])
      expect(calls.map((call) => call.args[0]).sort()).toEqual([
        'GIT_ALTERNATE_OBJECT_DIRECTORIES',
        'GIT_ATTR_SOURCE',
        'GIT_COMMON_DIR',
        'GIT_DIR',
        'GIT_INDEX_FILE',
        'GIT_NAMESPACE',
        'GIT_OBJECT_DIRECTORY',
        'GIT_REPLACE_REF_BASE',
        'GIT_WORK_TREE'
      ])
    })

    // readBytes is not tested here: Uint8Array.fromBase64 needs Node 25, and CI runs Node 24.
    // Nothing covers it until M4 adds a plugin-kit case that reads a file.
  })

  describe('session.start', () => {
    it('registers /beekeeper on an interactive session that meets the minimum', async () => {
      const calls = await startSession({}, { isInteractive: true })

      expect(calls).toEqual([
        {
          name: 'command.register',
          args: [{ name: 'beekeeper', description: t('command.description') }]
        }
      ])
    })

    it('shows the version in the status line and registers no command when Claude Code is too old', async () => {
      const calls = await startSession(
        { version: { version: '2.1.200', base: '2.1.200' } },
        { isInteractive: true }
      )

      expect(calls).toEqual([
        {
          name: 'ui.status',
          args: [t('start.tooOld', { minimum: '2.1.296', version: '2.1.200' })]
        }
      ])
    })

    it('shows fixed text in the status line and registers no command when the version call fails', async () => {
      const calls = await startSession({ versionFails: true }, { isInteractive: true })

      expect(calls).toEqual([{ name: 'ui.status', args: [t('start.failed')] }])
    })

    it('registers no command and sets no status on a non-interactive session that is ready', async () => {
      const calls = await startSession({}, { isInteractive: false })

      expect(calls).toEqual([])
    })

    it('registers nothing and sets no status on a session that is not interactive', async () => {
      const calls = await startSession(
        { version: { version: '2.1.200', base: '2.1.200' } },
        { isInteractive: false }
      )

      expect(calls).toEqual([])
    })
  })
})
