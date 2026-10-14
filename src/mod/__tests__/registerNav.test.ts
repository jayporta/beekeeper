import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaneNav } from '../features/shared/paneNav'
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

    expect(navWrites(engine)).toEqual([[NAV, { ...BROWSE, openId: 1 }]])
    expect(engine.timers.slice(before).map((timer) => [timer.kind, timer.ms])).toEqual([
      ['after', 0]
    ])
  })

  it('gives each opening of Browse its own open id, so a reopen is told from the open before it', async () => {
    const { engine, render } = harness({
      panes: [],
      state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })

    const first = await render()
    await (first['onNav'] as (nav: PaneNav) => Promise<void>)(BROWSE)
    engine.clearState()
    const second = await render()
    await (second['onNav'] as (nav: PaneNav) => Promise<void>)(BROWSE)

    const ids = navWrites(engine).map((write) => (write[1] as { openId?: number }).openId)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
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

  it("writes a loading Browse view when Browse is opened from another screen, so the last project's rows are not shown as current", async () => {
    const { engine, run, render } = harness({
      panes: [],
      state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })
    await run('session.start')

    const props = await render()
    await (props['onNav'] as (nav: PaneNav) => Promise<void>)(BROWSE)

    const browseWrites = engine.calls.filter(
      (call) => call.name === 'state.set' && JSON.stringify(call.args[0]).includes('browse')
    )
    expect(browseWrites.map((call) => call.args[1])).toEqual([
      expect.objectContaining({ status: 'loading', rows: [] })
    ])
  })

  it('writes no loading Browse view for a nav that stays on Browse', async () => {
    const { engine, render } = harness({
      state: { 'beekeeper.nav': BROWSE, 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })

    const props = await render()
    await (props['onPickProject'] as (dirName: string) => Promise<void>)('-q')

    expect(
      engine.calls.filter(
        (call) => call.name === 'state.set' && JSON.stringify(call.args[0]).includes('browse')
      )
    ).toEqual([])
  })

  it('hands the pane the width of its body', async () => {
    const { run } = harness()

    await run('ui.render', {
      surface: 'terminal',
      component: 'Pane',
      requestId: 'beekeeper',
      props: { title: 'beekeeper', isFocused: true, bodyColumns: 72 }
    })

    expect(drawn.props?.['columns']).toBe(72)
  })

  it('writes the nav only from the nav and pick handlers, whatever hooks and timers run', async () => {
    const { engine, runAll } = harness({ state: { 'beekeeper.nav': BROWSE } })

    await runAll()

    expect(navWrites(engine)).toEqual([])
  })

  describe('while Browse shows', () => {
    const afters = (engine: ReturnType<typeof createTestEngine>): number[] =>
      engine.timers.filter((timer) => timer.kind === 'after' && !timer.cancelled).map((t) => t.ms)

    /** Runs the debounced refresh a turn asked for, so this copy has built Browse. */
    async function buildBrowse(h: ReturnType<typeof harness>): Promise<void> {
      await h.run('turn.complete')
      h.engine.timers.filter((timer) => timer.kind === 'after').forEach((timer) => timer.fn())
      await new Promise((resolve) => setTimeout(resolve, 20))
      h.engine.timers.length = 0
    }

    it('refreshes on a turn when this copy has not built Browse yet, as after a hot reload', async () => {
      const h = harness({ state: { 'beekeeper.nav': BROWSE } })

      await h.run('turn.complete')

      expect(afters(h.engine)).toEqual([1000])
    })

    it.each(['turn.complete', 'agent.spawn'])(
      'does not refresh on %s once this copy has built Browse',
      async (event) => {
        const h = harness({ state: { 'beekeeper.nav': BROWSE } })
        await buildBrowse(h)

        await h.run(event)

        expect(afters(h.engine)).toEqual([])
      }
    )

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
    const viewWrites = (engine: ReturnType<typeof createTestEngine>): unknown[] =>
      engine.calls
        .filter(
          (call) => call.name === 'state.set' && JSON.stringify(call.args[0]).includes('view')
        )
        .map((call) => call.args[1])

    it("builds the current session's view, which the stored Browse nav would have blocked", async () => {
      const { engine, run } = harness({ state: { 'beekeeper.nav': BROWSE } })

      engine.clearState()
      await run('session.end')
      engine.timers.filter((timer) => timer.kind === 'after').forEach((timer) => timer.fn())
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(viewWrites(engine)).toEqual([expect.objectContaining({ target: 'current' })])
    })
  })
})

describe('the pane selection', () => {
  const SELECTED = { plugin: 'beekeeper', key: 'selected' }

  it('stores the selection and asks for a refresh at once when a row is pressed', async () => {
    const { engine, run, render } = harness({
      panes: [],
      state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })
    await run('session.start')
    const before = engine.timers.length

    const props = await render()
    await (props['onSelect'] as (key: string) => Promise<void>)('sub:a1')

    expect(
      engine.calls
        .filter(
          (call) =>
            call.name === 'state.set' && JSON.stringify(call.args[0]) === JSON.stringify(SELECTED)
        )
        .map((call) => call.args[1])
    ).toEqual([{ sessionId: 's1', key: 'sub:a1' }])
    expect(engine.timers.slice(before).map((timer) => [timer.kind, timer.ms])).toEqual([
      ['after', 0]
    ])
  })

  it('stores the selection and builds no timers when no other hook has run', async () => {
    const { engine, render } = harness({
      state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
    })

    const props = await render()
    await (props['onSelect'] as (key: string) => Promise<void>)('sub:a1')

    expect(engine.timers).toEqual([])
  })

  it('hands the pane the stored diff', async () => {
    const diffs = { sessionId: 's1', key: 'lead', status: 'none' }
    const { render } = harness({ state: { 'beekeeper.diffs': diffs } })

    expect((await render())['diffs']).toEqual(diffs)
  })

  describe('the worktree patch', () => {
    const PATCH = { plugin: 'beekeeper', key: 'patch' }
    type Patch = { onShow: (key: string) => Promise<void>; onHide: () => Promise<void> }
    const patchWrites = (engine: ReturnType<typeof createTestEngine>): unknown[] =>
      engine.calls
        .filter(
          (call) =>
            call.name === 'state.set' && JSON.stringify(call.args[0]) === JSON.stringify(PATCH)
        )
        .map((call) => call.args[1])

    it('stores a loading patch of the node and asks for a refresh at once when Show patch is pressed', async () => {
      const { engine, run, render } = harness({
        panes: [],
        state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
      })
      await run('session.start')
      const before = engine.timers.length

      const props = await render()
      await (props['patch'] as Patch).onShow('sub:a1')

      expect(patchWrites(engine)).toEqual([
        expect.objectContaining({ sessionId: 's1', key: 'sub:a1', status: 'loading' })
      ])
      expect(engine.timers.slice(before).map((timer) => [timer.kind, timer.ms])).toEqual([
        ['after', 0]
      ])
    })

    it('stores a hidden patch and builds no timers when Hide patch is pressed', async () => {
      const { engine, render } = harness({
        state: { 'beekeeper.view': testPaneView(testPaneNode('lead')) }
      })

      const props = await render()
      await (props['patch'] as Patch).onHide()

      expect(patchWrites(engine)).toEqual([expect.objectContaining({ status: 'none' })])
      expect(engine.timers).toEqual([])
    })

    it('hands the pane the stored patch', async () => {
      const stored = { sessionId: 's1', key: 'sub:a1', status: 'none' }
      const { render } = harness({ state: { 'beekeeper.patch': stored } })

      expect(((await render())['patch'] as { stored: unknown }).stored).toEqual(stored)
    })
  })
})
