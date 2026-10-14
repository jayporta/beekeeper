import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaneNav } from '../features/pane/paneNav'
import { testPaneNode, testPaneView } from '../features/pane/testPaneView'
import { createTestEngine, type TestEngineAnswers } from '../testEngine'
import { createNext } from '../testNext'
import { recordingOn } from '../testOn'

/** The props the last `Pane` call got, so a test can press what the pane would hand its buttons. */
const drawn: { props: Record<string, unknown> | null } = { props: null }

vi.mock('../lib.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib.js')>()),
  Pane: (props: Record<string, unknown>): object => {
    drawn.props = props
    return {}
  }
}))

const { register } = await import('../register')

const NAV = { plugin: 'beekeeper', key: 'nav' }
const BROWSE: PaneNav = { screen: 'browse', projectDirName: null }

beforeEach(() => {
  drawn.props = null
})

/** The registered hooks, a fake engine, and a way to run one hook or all of them. */
function harness(answers: TestEngineAnswers = {}): {
  engine: ReturnType<typeof createTestEngine>
  run: (event: string, input?: object) => Promise<unknown>
  runAll: () => Promise<void>
  render: () => Promise<Record<string, unknown>>
} {
  const { on, registered } = recordingOn()
  register(on, {})
  const engine = createTestEngine({ panes: ['beekeeper'], ...answers })
  const inputs: Record<string, object> = {
    'session.start': { cwd: '/work', surface: 'terminal', isInteractive: true },
    'session.end': { reason: 'clear' },
    'ui.render': { surface: 'terminal', component: 'Pane', requestId: 'beekeeper', props: {} }
  }
  const run = async (event: string, input: object = inputs[event] ?? {}): Promise<unknown> => {
    const hook = registered.find((entry) => entry.event === event)
    return hook?.hook(engine.$, input, createNext({}).next)
  }
  const runAll = async (): Promise<void> => {
    for (const entry of registered) await run(entry.event)
    for (const timer of engine.timers) timer.fn()
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  const render = async (): Promise<Record<string, unknown>> => {
    await run('ui.render')
    return drawn.props ?? {}
  }
  return { engine, run, runAll, render }
}

const navWrites = (engine: ReturnType<typeof createTestEngine>): unknown[][] =>
  engine.calls
    .filter(
      (call) => call.name === 'state.set' && JSON.stringify(call.args[0]) === JSON.stringify(NAV)
    )
    .map((call) => [...call.args])

describe('the pane nav', () => {
  it('hands the pane the stored nav and browse view, and none when nothing is stored', async () => {
    const stored = harness({ state: { 'beekeeper.nav': BROWSE } })
    const empty = harness()

    expect((await stored.render())['nav']).toEqual(BROWSE)
    expect((await empty.render())['nav']).toBeUndefined()
  })

  it('stores the nav, and asks for a refresh with the list at once, when a nav button is pressed', async () => {
    const { engine, run, render } = harness({
      panes: [],
      state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })
    await run('session.start')
    const before = engine.timers.length

    const props = await render()
    await (props['onNav'] as (nav: PaneNav) => Promise<void>)(BROWSE)

    expect(navWrites(engine)).toEqual([[NAV, BROWSE]])
    expect(engine.timers.slice(before).map((timer) => [timer.kind, timer.ms])).toEqual([
      ['after', 0]
    ])
  })

  it('opens Browse on the picked project and refreshes at once', async () => {
    const { engine, run, render } = harness({
      panes: [],
      state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })
    await run('session.start')
    const before = engine.timers.length

    const props = await render()
    await (props['onPickProject'] as (dirName: string) => Promise<void>)('-q')

    expect(navWrites(engine)).toEqual([[NAV, { screen: 'browse', projectDirName: '-q' }]])
    expect(engine.timers.slice(before).map((timer) => [timer.kind, timer.ms])).toEqual([
      ['after', 0]
    ])
  })

  it('stores the nav but builds no wiring or timers when no other hook has run', async () => {
    const { engine, render } = harness()

    const props = await render()
    await (props['onNav'] as (nav: PaneNav) => Promise<void>)(BROWSE)

    expect(navWrites(engine)).toHaveLength(1)
    expect(engine.timers).toEqual([])
  })

  it('writes the nav only from the nav and pick handlers, whatever hooks and timers run', async () => {
    const { engine, runAll } = harness({ state: { 'beekeeper.nav': BROWSE } })

    await runAll()

    expect(navWrites(engine)).toEqual([])
  })

  describe('while Browse shows', () => {
    it.each(['turn.complete', 'agent.spawn'])('does not refresh on %s', async (event) => {
      const { engine, run } = harness({ state: { 'beekeeper.nav': BROWSE } })

      await run(event)

      expect(engine.timers.filter((timer) => timer.kind === 'after')).toEqual([])
    })

    it('still starts the ticks, so the list tick keeps Browse fresh', async () => {
      const { engine, run } = harness({ state: { 'beekeeper.nav': BROWSE } })

      await run('turn.complete')

      expect(engine.timers.filter((timer) => timer.kind === 'every')).toHaveLength(2)
    })

    it('refreshes on a turn again once the nav is the current screen', async () => {
      const { engine, run } = harness({ state: { 'beekeeper.nav': { screen: 'current' } } })

      await run('turn.complete')

      expect(engine.timers.filter((timer) => timer.kind === 'after')).toHaveLength(1)
    })
  })

  describe('after a /clear', () => {
    it('reads the nav as the current screen, since the state is emptied', async () => {
      const { engine, run, render } = harness({ state: { 'beekeeper.nav': BROWSE } })

      engine.clearState()
      await run('session.end')

      expect((await render())['nav']).toBeUndefined()
    })

    it('refreshes the current session, which a stored Browse nav would have blocked', async () => {
      const { engine, run } = harness({ state: { 'beekeeper.nav': BROWSE } })
      await run('session.end')
      expect(engine.timers.filter((timer) => timer.kind === 'after')).toEqual([])

      engine.clearState()
      await run('session.end')

      expect(engine.timers.filter((timer) => timer.kind === 'after').map((t) => t.ms)).toEqual([
        1000
      ])
    })
  })
})
