import { describe, expect, it } from 'vitest'
import {
  createPaneScheduler,
  PLAIN_TICK_MS,
  LIST_TICK_MS,
  type PaneSchedulerDeps
} from '../paneScheduler'

/** A manual clock: timers run only when a test fires them. */
interface FakeTimer {
  readonly ms: number
  readonly fn: () => void
  cancelled: boolean
}

interface Harness {
  readonly scheduler: ReturnType<typeof createPaneScheduler>
  readonly afters: FakeTimer[]
  readonly everys: FakeTimer[]
  /** The `withList` of each refresh that started, in order. */
  readonly started: boolean[]
  /** How many refreshes are running now. */
  readonly running: () => number
  /** Finishes the oldest running refresh, or fails it. */
  readonly finish: (error?: Error) => Promise<void>
  open: boolean | Error
  wantsList: boolean
}

function harness(): Harness {
  const afters: FakeTimer[] = []
  const everys: FakeTimer[] = []
  const started: boolean[] = []
  const settlers: Array<{ resolve: () => void; reject: (error: Error) => void }> = []
  const state = { open: true as boolean | Error, wantsList: true }
  const timer =
    (list: FakeTimer[]): PaneSchedulerDeps['after'] =>
    (ms, fn) => {
      const fake: FakeTimer = { ms, fn, cancelled: false }
      list.push(fake)
      return {
        cancel: () => {
          fake.cancelled = true
        }
      }
    }
  const deps: PaneSchedulerDeps = {
    after: timer(afters),
    every: timer(everys),
    isPaneOpen: async () => {
      if (state.open instanceof Error) throw state.open
      return state.open
    },
    wantsListTick: () => state.wantsList,
    refresh: ({ withList }) => {
      started.push(withList)
      return new Promise<void>((resolve, reject) => settlers.push({ resolve, reject }))
    }
  }
  const harnessObject: Harness = {
    scheduler: createPaneScheduler(deps),
    afters,
    everys,
    started,
    running: () => settlers.length,
    finish: async (error) => {
      const next = settlers.shift()
      if (error) next?.reject(error)
      else next?.resolve()
      await flush()
    },
    get open() {
      return state.open
    },
    set open(value) {
      state.open = value
    },
    get wantsList() {
      return state.wantsList
    },
    set wantsList(value) {
      state.wantsList = value
    }
  }
  return harnessObject
}

/** Lets pending promise callbacks run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

describe('single flight', () => {
  it('runs one refresh at a time and one queued refresh after it', async () => {
    const h = harness()

    void h.scheduler.refreshNow(false)
    void h.scheduler.refreshNow(false)
    void h.scheduler.refreshNow(false)
    await flush()

    expect(h.started).toEqual([false])
    expect(h.running()).toBe(1)

    await h.finish()
    expect(h.started).toEqual([false, false])
    expect(h.running()).toBe(1)

    await h.finish()
    expect(h.started).toEqual([false, false])
  })

  it('lets a queued list refresh win over a plain one, in either order', async () => {
    const plainThenList = harness()
    void plainThenList.scheduler.refreshNow(false)
    void plainThenList.scheduler.refreshNow(false)
    void plainThenList.scheduler.refreshNow(true)
    await plainThenList.finish()

    const listThenPlain = harness()
    void listThenPlain.scheduler.refreshNow(false)
    void listThenPlain.scheduler.refreshNow(true)
    void listThenPlain.scheduler.refreshNow(false)
    await listThenPlain.finish()

    expect(plainThenList.started).toEqual([false, true])
    expect(listThenPlain.started).toEqual([false, true])
  })

  it('keeps going after a refresh fails', async () => {
    const h = harness()

    void h.scheduler.refreshNow(false)
    await flush()
    await h.finish(new Error('boom'))
    void h.scheduler.refreshNow(true)
    await flush()

    expect(h.started).toEqual([false, true])
  })
})

describe('debounce', () => {
  it('sets one timer for several requests and refreshes once with the list if any asked for it', async () => {
    const h = harness()

    h.scheduler.schedule({ withList: false, delayMs: 1000 })
    h.scheduler.schedule({ withList: true, delayMs: 1000 })
    h.scheduler.schedule({ withList: false, delayMs: 1000 })

    expect(h.afters).toHaveLength(1)
    h.afters[0]?.fn()
    await flush()
    expect(h.started).toEqual([true])
  })

  it('starts a new timer for a request made after the last one fired', async () => {
    const h = harness()

    h.scheduler.schedule({ withList: true, delayMs: 1000 })
    h.afters[0]?.fn()
    await flush()
    h.scheduler.schedule({ withList: false, delayMs: 1000 })

    expect(h.afters).toHaveLength(2)
  })

  it('replaces a pending timer with a sooner one and keeps the list request', async () => {
    const h = harness()

    h.scheduler.schedule({ withList: true, delayMs: 1000 })
    h.scheduler.schedule({ withList: false, delayMs: 0 })

    expect(h.afters.map((timer) => [timer.ms, timer.cancelled])).toEqual([
      [1000, true],
      [0, false]
    ])
    h.afters[1]?.fn()
    await flush()
    expect(h.started).toEqual([true])
  })
})

describe('ticks', () => {
  it('starts a plain and a list tick once, however often it is asked', () => {
    const h = harness()

    h.scheduler.ensureTicks()
    h.scheduler.ensureTicks()

    expect(h.everys.map((timer) => timer.ms)).toEqual([PLAIN_TICK_MS, LIST_TICK_MS])
  })

  it('refreshes on each tick while the pane is open, with the list on the list tick', async () => {
    const h = harness()
    h.scheduler.ensureTicks()

    h.everys[0]?.fn()
    await flush()
    await h.finish()
    h.everys[1]?.fn()
    await flush()

    expect(h.started).toEqual([false, true])
  })

  it('skips the list tick when the session has no team', async () => {
    const h = harness()
    h.wantsList = false
    h.scheduler.ensureTicks()

    h.everys[1]?.fn()
    await flush()

    expect(h.started).toEqual([])
  })

  it('stops both ticks when the pane is no longer open, and does not refresh', async () => {
    const h = harness()
    h.scheduler.ensureTicks()
    h.open = false

    h.everys[0]?.fn()
    await flush()

    expect(h.everys.map((timer) => timer.cancelled)).toEqual([true, true])
    expect(h.started).toEqual([])
  })

  it('starts fresh ticks after they stopped', async () => {
    const h = harness()
    h.scheduler.ensureTicks()
    h.open = false
    h.everys[0]?.fn()
    await flush()

    h.scheduler.ensureTicks()

    expect(h.everys).toHaveLength(4)
  })

  it('keeps ticking when the pane list cannot be read', async () => {
    const h = harness()
    h.scheduler.ensureTicks()
    h.open = new Error('engine down')

    h.everys[0]?.fn()
    await flush()

    expect(h.everys.map((timer) => timer.cancelled)).toEqual([false, false])
    expect(h.started).toEqual([])
  })

  it('cancels its ticks when told to stop', () => {
    const h = harness()
    h.scheduler.ensureTicks()

    h.scheduler.stopTicks()

    expect(h.everys.map((timer) => timer.cancelled)).toEqual([true, true])
  })
})
