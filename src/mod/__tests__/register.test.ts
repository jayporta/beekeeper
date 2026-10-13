import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { t } from '../i18n/modI18n'
import { hostOf, register } from '../register'
import { createTestEngine, TEST_ELEMENTS, type TestEngineAnswers } from '../testEngine'
import { installTestH, removeTestH, textOf, findAll } from '../features/pane/testElements'
import { testPaneNode, testPaneView } from '../features/pane/testPaneView'
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

/** The registered hooks run against a fake engine whose panes and timers a test can inspect. */
type PaneHarness = ReturnType<typeof createTestEngine> & {
  /** Runs the hook registered for an event, with an input. */
  run: (event: string, input?: object) => Promise<unknown>
  /** The waits of the `after` timers started so far. */
  afters: () => number[]
  /** The waits of the `every` timers started so far. */
  everys: () => number[]
}

describe('register', () => {
  it('registers session.start, the beekeeper command and the Pane render', () => {
    const { on, registered } = recordingOn()

    register(on, {})

    expect(registered.map(({ event, matcher }) => ({ event, matcher }))).toEqual([
      { event: 'session.start', matcher: undefined },
      { event: 'command.run', matcher: { command: 'beekeeper' } },
      { event: 'turn.complete', matcher: undefined },
      { event: 'agent.spawn', matcher: undefined },
      { event: 'session.end', matcher: undefined },
      { event: 'ui.render', matcher: { component: 'Pane', requestId: 'beekeeper' } }
    ])
  })

  it('opens the beekeeper pane and replies with one line when /beekeeper runs', async () => {
    const { on, registered } = recordingOn()
    register(on, {})
    const command = registered.find((entry) => entry.event === 'command.run')
    const { $, calls } = createTestEngine()

    const reply = await (command?.hook as unknown as (engine: typeof $) => Promise<unknown>)($)

    expect(calls.filter((call) => call.name === 'ui.open')).toEqual([
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

  describe('refreshing the pane', () => {
    /** The registered hooks by event, a fake engine and a way to run one. */
    function pane(answers: TestEngineAnswers = {}): PaneHarness {
      const { on, registered } = recordingOn()
      register(on, {})
      const engine = createTestEngine({ panes: ['beekeeper'], ...answers })
      const run = async (event: string, input: object = {}): Promise<unknown> => {
        const hook = registered.find((entry) => entry.event === event)
        const { next } = createNext({ ok: true })
        return hook?.hook(engine.$, input, next)
      }
      const afters = (): number[] =>
        engine.timers.filter((timer) => timer.kind === 'after').map((timer) => timer.ms)
      const everys = (): number[] =>
        engine.timers.filter((timer) => timer.kind === 'every').map((timer) => timer.ms)
      return { ...engine, run, afters, everys }
    }

    it('refreshes at once with the list and starts the ticks when /beekeeper opens the pane', async () => {
      const { run, afters, everys } = pane()

      await run('command.run')

      expect(afters()).toEqual([0])
      expect(everys()).toEqual([10_000, 30_000])
    })

    it('does not start a second pair of ticks when /beekeeper runs twice', async () => {
      const { run, everys } = pane()

      await run('command.run')
      await run('command.run')

      expect(everys()).toEqual([10_000, 30_000])
    })

    it('debounces a refresh by one second after a turn completes while the pane is open', async () => {
      const { run, afters } = pane()

      await run('turn.complete')
      await run('turn.complete')

      expect(afters()).toEqual([1000])
    })

    it('restarts the ticks on a turn that completes in a copy that has none', async () => {
      const { run, everys } = pane()

      await run('turn.complete')

      expect(everys()).toEqual([10_000, 30_000])
    })

    it('does nothing for a turn that completes while the pane is closed', async () => {
      const { run, timers } = pane({ panes: [] })

      await run('turn.complete')

      expect(timers).toEqual([])
    })

    it('debounces a refresh after an agent spawns while the pane is open', async () => {
      const { run, afters } = pane()

      await run('agent.spawn')

      expect(afters()).toEqual([1000])
    })

    it('refreshes after a /clear, once the session has its new id', async () => {
      const { run, afters } = pane()

      await run('session.end', { reason: 'clear' })

      expect(afters()).toEqual([1000])
    })

    it.each(['logout', 'other', 'resume'])(
      'does not refresh when the session ends for %s',
      async (reason) => {
        const { run, timers } = pane()

        await run('session.end', { reason })

        expect(timers).toEqual([])
      }
    )

    it('passes each of those events on and answers what the engine answered', async () => {
      const { run } = pane()

      expect(await run('turn.complete')).toEqual({ ok: true })
      expect(await run('agent.spawn')).toEqual({ ok: true })
      expect(await run('session.end', { reason: 'clear' })).toEqual({ ok: true })
    })

    it('writes a waiting view to $.state when the debounce fires before a transcript exists', async () => {
      const { run, timers, calls } = pane()
      await run('agent.spawn')

      timers.find((timer) => timer.kind === 'after')?.fn()
      await new Promise((resolve) => setTimeout(resolve, 20))

      const writes = calls.filter((call) => call.name === 'state.set')
      expect(writes).toHaveLength(1)
      expect(writes[0]?.args[0]).toEqual({ plugin: 'beekeeper', key: 'view' })
      expect(writes[0]?.args[1]).toMatchObject({ status: 'waiting' })
    })

    it('starts the ticks when a session starts with the pane already open', async () => {
      const { run, everys } = pane()

      await run('session.start', { cwd: '/work', surface: 'terminal', isInteractive: true })

      expect(everys()).toEqual([10_000, 30_000])
    })
  })

  describe('drawing the pane', () => {
    beforeAll(installTestH)
    afterAll(removeTestH)

    const view = testPaneView(
      testPaneNode('lead', { kind: 'lead', name: 'Lead', children: [testPaneNode('sub:a')] }),
      { sessionId: 'sid' }
    )

    /**
     * Runs the registered render hook against an engine holding `state`. With
     * `startedFirst`, a non-render hook (`session.start`, pane closed) runs first and sets up the timers.
     */
    async function render(
      state: Record<string, unknown>,
      options: { startedFirst?: boolean; times?: number } = {}
    ): Promise<{
      tree: unknown
      engine: ReturnType<typeof createTestEngine>
    }> {
      const { on, registered } = recordingOn()
      register(on, {})
      const engine = createTestEngine({ state, panes: [] })
      if (options.startedFirst) {
        const start = registered.find((entry) => entry.event === 'session.start')
        await start?.hook(
          engine.$,
          { cwd: '/work', surface: 'terminal', isInteractive: false },
          createNext({ cwd: '/work' }).next
        )
      }
      const hook = registered.find((entry) => entry.event === 'ui.render')
      let tree: unknown
      for (let i = 0; i < (options.times ?? 1); i += 1) {
        tree = await hook?.hook(
          engine.$,
          { surface: 'terminal', component: 'Pane', requestId: 'beekeeper', props: {} },
          createNext({}).next
        )
      }
      return { tree, engine }
    }

    it('draws the stored view', async () => {
      const { tree } = await render({ 'beekeeper.view': view })

      expect(textOf(tree)).toContain('Fix the bug')
    })

    it('asks for one refresh, with the list, through timers an earlier hook set up', async () => {
      const { tree, engine } = await render({}, { startedFirst: true, times: 3 })

      expect(textOf(tree)).toContain(t('pane.loading'))
      expect(engine.timers.map((timer) => [timer.kind, timer.ms])).toEqual([['after', 0]])
    })

    it('sets up no timers itself when no other hook has run, so none holds its engine', async () => {
      const { tree, engine } = await render({})

      expect(textOf(tree)).toContain(t('pane.loading'))
      expect(engine.timers).toEqual([])
    })

    it('does not ask for a refresh when a view is stored', async () => {
      const { engine } = await render({ 'beekeeper.view': view }, { startedFirst: true })

      expect(engine.timers).toEqual([])
    })

    it('never writes state while it draws', async () => {
      const { engine } = await render({})

      expect(engine.calls.filter((call) => call.name === 'state.set')).toEqual([])
    })

    it('stores the selection, with the session, when a row is pressed', async () => {
      const { tree, engine } = await render({ 'beekeeper.view': view })
      const row = findAll(tree, TEST_ELEMENTS.Button).find((node) => node.props['key'] === 'sub:a')

      await (row?.props['onPress'] as () => Promise<void>)()

      expect(engine.calls.filter((call) => call.name === 'state.set')).toEqual([
        {
          name: 'state.set',
          args: [
            { plugin: 'beekeeper', key: 'selected' },
            { sessionId: 'sid', key: 'sub:a' }
          ]
        }
      ])
    })
  })
})
