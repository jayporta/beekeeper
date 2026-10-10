import { QueryObserver, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { testProject } from '@renderer/testBeekeeperApi'
import { createInvalidationApplier, type InvalidationApplier } from '../createInvalidationApplier'
import type { InvalidationPlan } from '../invalidationPlan'

const A = '-Users-a-repo'
const A_WORKTREE = '-Users-a-repo--claude-worktrees-feature'
const B = '-Users-b-other'
const SESSION = '11111111-1111-4111-8111-111111111111'

const planFor = (families: string[], staleTotals: string[] = families): InvalidationPlan => ({
  projects: false,
  families: new Set(families),
  staleTotals: new Set(staleTotals)
})
const ALL: InvalidationPlan = { projects: true, families: 'all', staleTotals: 'all' }

/** Timers a test runs by hand, in place of the applier's real ones. */
function manualTimers(): {
  setTimer: (run: () => void) => number
  clearTimer: (handle: unknown) => void
  runAll: () => void
} {
  const pending = new Map<number, () => void>()
  let next = 0
  return {
    setTimer: (run) => {
      pending.set(++next, run)
      return next
    },
    clearTimer: (handle) => {
      pending.delete(handle as number)
    },
    runAll: () => {
      const runs = [...pending.values()]
      pending.clear()
      for (const run of runs) run()
    }
  }
}

let client: QueryClient
let unsubscribers: (() => void)[]
let timers: ReturnType<typeof manualTimers>
let applier: InvalidationApplier

beforeEach(() => {
  client = createTestQueryClient()
  unsubscribers = []
  timers = manualTimers()
  applier = createInvalidationApplier(client, timers)
})

afterEach(() => {
  applier.dispose()
  for (const unsubscribe of unsubscribers) unsubscribe()
  client.clear()
})

/** Seeds fresh data for a key and keeps an observer on it, so the query is active. Returns its query function. */
function showing(queryKey: QueryKey, data: unknown = ['seed']): Mock<() => Promise<unknown>> {
  client.setQueryData(queryKey, data)
  const queryFn = vi.fn<() => Promise<unknown>>(() => Promise.resolve(data))
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn,
    staleTime: Infinity,
    refetchOnMount: false,
    retryOnMount: false
  })
  unsubscribers.push(observer.subscribe(() => undefined))
  return queryFn
}

/** Puts a query in `error` status, with or without data, and keeps an observer on it. */
async function showingFailure(
  queryKey: QueryKey,
  { error, data }: { error: Error; data?: unknown }
): Promise<Mock<() => Promise<unknown>>> {
  if (data !== undefined) client.setQueryData(queryKey, data)
  await client
    .fetchQuery({ queryKey, queryFn: () => Promise.reject(error), retry: false, staleTime: 0 })
    .catch(() => undefined)
  const queryFn = vi.fn<() => Promise<unknown>>(() => Promise.resolve(['refetched']))
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn,
    staleTime: Infinity,
    refetchOnMount: false,
    retryOnMount: false
  })
  unsubscribers.push(observer.subscribe(() => undefined))
  return queryFn
}

/** Keeps a query on screen with a fetch in flight, which the test settles by hand. */
function fetching(
  queryKey: QueryKey,
  { data }: { data?: unknown } = {}
): {
  queryFn: Mock<() => Promise<unknown>>
  resolve: (value: unknown) => void
  reject: (error: Error) => void
} {
  if (data !== undefined) client.setQueryData(queryKey, data)
  const settlers: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = []
  const queryFn = vi.fn<() => Promise<unknown>>(
    () =>
      new Promise((resolve, reject) => {
        settlers.push({ resolve, reject })
      })
  )
  const observer = new QueryObserver(client, { queryKey, queryFn, staleTime: 0, retry: false })
  unsubscribers.push(observer.subscribe(() => undefined))
  return {
    queryFn,
    resolve: (value) => settlers.shift()?.resolve(value),
    reject: (error) => settlers.shift()?.reject(error)
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('createInvalidationApplier', () => {
  it('refetches the visible session list and detail of a changed family', async () => {
    const list = showing(['sessions', A])
    const detail = showing(['session', A, SESSION])

    applier.apply(planFor([A]))
    timers.runAll()

    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1)
      expect(detail).toHaveBeenCalledTimes(1)
    })
  })

  it('leaves another family alone', async () => {
    const otherList = showing(['sessions', B])
    const otherDetail = showing(['session', B, SESSION])

    applier.apply(planFor([A]))
    timers.runAll()
    await settle()

    expect(otherList).not.toHaveBeenCalled()
    expect(otherDetail).not.toHaveBeenCalled()
  })

  it('refetches a worktree folder’s list when its family changed', async () => {
    client.setQueryData(
      ['projects'],
      [testProject(A), testProject(A_WORKTREE, { worktreeOf: A, worktreeName: 'feature' })]
    )
    const worktreeList = showing(['sessions', A_WORKTREE])

    applier.apply(planFor([A]))

    await vi.waitFor(() => {
      expect(worktreeList).toHaveBeenCalledTimes(1)
    })
  })

  it('does not refetch a session list nothing shows', async () => {
    client.setQueryData(['sessions', A], ['seed'])
    const queryFn = vi.fn(() => Promise.resolve(['fresh']))
    client.setQueryDefaults(['sessions', A], { queryFn })

    applier.apply(planFor([A]))
    await settle()

    expect(queryFn).not.toHaveBeenCalled()
    expect(client.getQueryState(['sessions', A])?.isInvalidated).toBe(true)
  })

  it('marks a changed folder’s totals and daily usage stale without refetching them', async () => {
    const totals = showing(['projectTotals', A, '7d'])
    const usage = showing(['projectDailyUsage', A, '7d', '2026-10-08'])

    applier.apply(planFor([A]))
    await settle()

    expect(totals).not.toHaveBeenCalled()
    expect(usage).not.toHaveBeenCalled()
    expect(client.getQueryState(['projectTotals', A, '7d'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['projectDailyUsage', A, '7d', '2026-10-08'])?.isInvalidated).toBe(
      true
    )
  })

  it('leaves another folder’s totals fresh', async () => {
    showing(['projectTotals', B, '7d'])

    applier.apply(planFor([A]))
    await settle()

    expect(client.getQueryState(['projectTotals', B, '7d'])?.isInvalidated).toBe(false)
  })

  it('leaves worktree diffs and patches alone', async () => {
    const diffs = showing(['worktreeDiffs', A, SESSION])
    const patch = showing(['worktreePatch', A, SESSION, 'agent'])

    applier.apply(ALL)
    await settle()

    expect(diffs).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
  })

  it('refetches the project list only when the plan says so', async () => {
    const projects = showing(['projects'])

    applier.apply(planFor([A]))
    await settle()
    expect(projects).not.toHaveBeenCalled()

    applier.apply({ ...planFor([A]), projects: true })
    await vi.waitFor(() => {
      expect(projects).toHaveBeenCalledTimes(1)
    })
  })

  it('refetches every visible list and detail for an all plan', async () => {
    const list = showing(['sessions', A])
    const otherDetail = showing(['session', B, SESSION])

    applier.apply(ALL)
    timers.runAll()

    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1)
      expect(otherDetail).toHaveBeenCalledTimes(1)
    })
  })

  it('lets a refetch already in flight finish instead of restarting it', async () => {
    const list = fetching(['sessions', A], { data: ['seed'] })
    await vi.waitFor(() => {
      expect(list.queryFn).toHaveBeenCalledTimes(1)
    })

    applier.apply(planFor([A]))
    await settle()
    expect(list.queryFn).toHaveBeenCalledTimes(1)
    list.resolve(['first'])

    await vi.waitFor(() => {
      expect(client.getQueryData(['sessions', A])).toEqual(['first'])
    })
  })

  describe('a query showing an error screen', () => {
    it('leaves a failed session list with no data alone', async () => {
      const queryFn = await showingFailure(['sessions', A], { error: new IpcCallError('internal') })

      applier.apply(planFor([A]))
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('leaves a list whose folder is gone alone, even with data', async () => {
      const queryFn = await showingFailure(['sessions', A], {
        error: new IpcCallError('not-found'),
        data: ['stale']
      })

      applier.apply(planFor([A]))
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('leaves a failed session detail with no data alone', async () => {
      const queryFn = await showingFailure(['session', A, SESSION], {
        error: new IpcCallError('internal')
      })

      applier.apply(planFor([A]))
      timers.runAll()
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('leaves a failed project list with no projects alone', async () => {
      const queryFn = await showingFailure(['projects'], { error: new IpcCallError('internal') })

      applier.apply({ ...planFor([A]), projects: true })
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('refetches a failed list that still shows its data', async () => {
      const queryFn = await showingFailure(['sessions', A], {
        error: new IpcCallError('internal'),
        data: ['stale']
      })

      applier.apply(planFor([A]))

      await vi.waitFor(() => {
        expect(queryFn).toHaveBeenCalledTimes(1)
      })
    })

    it('refetches a failed session detail that still shows its data', async () => {
      const queryFn = await showingFailure(['session', A, SESSION], {
        error: new IpcCallError('internal'),
        data: { stale: true }
      })

      applier.apply(planFor([A]))
      timers.runAll()

      await vi.waitFor(() => {
        expect(queryFn).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('session details', () => {
    it('are refreshed when the throttle interval ends, while lists refresh at once', async () => {
      const list = showing(['sessions', A])
      const detail = showing(['session', A, SESSION])

      applier.apply(planFor([A]))
      await vi.waitFor(() => {
        expect(list).toHaveBeenCalledTimes(1)
      })
      expect(detail).not.toHaveBeenCalled()

      timers.runAll()
      await vi.waitFor(() => {
        expect(detail).toHaveBeenCalledTimes(1)
      })
    })

    it('are refreshed once for several changes in one interval', async () => {
      const detail = showing(['session', A, SESSION])

      applier.apply(planFor([A]))
      applier.apply(planFor([A]))
      applier.apply(planFor([A]))
      timers.runAll()

      await vi.waitFor(() => {
        expect(detail).toHaveBeenCalledTimes(1)
      })
      await settle()
      expect(detail).toHaveBeenCalledTimes(1)
    })

    it('are refreshed for every family changed during the interval', async () => {
      const first = showing(['session', A, SESSION])
      const second = showing(['session', B, SESSION])

      applier.apply(planFor([A]))
      applier.apply(planFor([B]))
      timers.runAll()

      await vi.waitFor(() => {
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
      })
    })

    it('are all refreshed at once, with everything else, by applyAll', async () => {
      const list = showing(['sessions', A])
      const detail = showing(['session', B, SESSION])

      applier.applyAll()

      await vi.waitFor(() => {
        expect(list).toHaveBeenCalledTimes(1)
        expect(detail).toHaveBeenCalledTimes(1)
      })
    })

    it('are not refreshed again by the timer after applyAll', async () => {
      const detail = showing(['session', A, SESSION])
      applier.apply(planFor([A]))

      applier.applyAll()
      await vi.waitFor(() => {
        expect(detail).toHaveBeenCalledTimes(1)
      })
      timers.runAll()
      await settle()

      expect(detail).toHaveBeenCalledTimes(1)
    })

    it('are dropped by cancelPending', async () => {
      const detail = showing(['session', A, SESSION])
      applier.apply(planFor([A]))

      applier.cancelPending()
      timers.runAll()
      await settle()

      expect(detail).not.toHaveBeenCalled()
    })

    it('are dropped on dispose', async () => {
      const detail = showing(['session', A, SESSION])
      applier.apply(planFor([A]))

      applier.dispose()
      timers.runAll()
      await settle()

      expect(detail).not.toHaveBeenCalled()
    })
  })

  describe('a change that arrives while a matching query is fetching', () => {
    it('causes one more fetch once that one finishes', async () => {
      const list = fetching(['sessions', A], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })

      applier.apply(planFor([A]))
      await settle()
      expect(list.queryFn).toHaveBeenCalledTimes(1)
      list.resolve(['first'])

      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(2)
      })
      list.resolve(['second'])
      await settle()
      expect(list.queryFn).toHaveBeenCalledTimes(2)
    })

    it('causes only one more fetch however many changes arrive', async () => {
      const list = fetching(['sessions', A], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })

      applier.apply(planFor([A]))
      applier.apply(planFor([A]))
      applier.apply(planFor([A]))
      list.resolve(['first'])
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(2)
      })
      list.resolve(['second'])
      await settle()

      expect(list.queryFn).toHaveBeenCalledTimes(2)
    })

    it('causes no more fetches when the change was for another family', async () => {
      const list = fetching(['sessions', A], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })

      applier.apply(planFor([B]))
      list.resolve(['first'])
      await settle()

      expect(list.queryFn).toHaveBeenCalledTimes(1)
    })

    it('keeps a fetching totals query marked stale after it finishes, without refetching it', async () => {
      const totals = fetching(['projectTotals', A, '7d'], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(totals.queryFn).toHaveBeenCalledTimes(1)
      })

      applier.apply(planFor([A]))
      totals.resolve(['first'])
      await settle()

      expect(client.getQueryState(['projectTotals', A, '7d'])?.isInvalidated).toBe(true)
      expect(totals.queryFn).toHaveBeenCalledTimes(1)
    })

    it('holds a session detail’s follow-up until the next throttle flush', async () => {
      const detail = fetching(['session', A, SESSION], { data: { seed: true } })
      await vi.waitFor(() => {
        expect(detail.queryFn).toHaveBeenCalledTimes(1)
      })
      applier.apply(planFor([A]))
      timers.runAll()

      detail.resolve({ first: true })
      await settle()
      expect(detail.queryFn).toHaveBeenCalledTimes(1)

      timers.runAll()
      await vi.waitFor(() => {
        expect(detail.queryFn).toHaveBeenCalledTimes(2)
      })
    })

    it('follows up a session detail by its family, as the worktree folder’s parent', async () => {
      client.setQueryData(
        ['projects'],
        [testProject(A), testProject(A_WORKTREE, { worktreeOf: A, worktreeName: 'feature' })]
      )
      const detail = fetching(['session', A_WORKTREE, SESSION], { data: { seed: true } })
      await vi.waitFor(() => {
        expect(detail.queryFn).toHaveBeenCalledTimes(1)
      })
      applier.apply(planFor([A]))
      timers.runAll()

      detail.resolve({ first: true })
      await settle()
      timers.runAll()

      await vi.waitFor(() => {
        expect(detail.queryFn).toHaveBeenCalledTimes(2)
      })
    })

    it('causes no more fetches once cancelPending is called, as when live updates are paused', async () => {
      const list = fetching(['sessions', A], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })
      applier.apply(planFor([A]))

      applier.cancelPending()
      list.resolve(['first'])
      await settle()

      expect(list.queryFn).toHaveBeenCalledTimes(1)
    })

    it('follows up a change that arrives after cancelPending', async () => {
      const list = fetching(['sessions', A], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })
      applier.cancelPending()

      applier.apply(planFor([A]))
      list.resolve(['first'])

      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(2)
      })
    })

    it('does not refetch a query that failed with nothing to show', async () => {
      const list = fetching(['sessions', A])
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })

      applier.apply(planFor([A]))
      list.reject(new IpcCallError('internal'))
      await settle()

      expect(list.queryFn).toHaveBeenCalledTimes(1)
    })

    it('causes no more fetches after dispose', async () => {
      const list = fetching(['sessions', A], { data: ['seed'] })
      await vi.waitFor(() => {
        expect(list.queryFn).toHaveBeenCalledTimes(1)
      })
      applier.apply(planFor([A]))

      applier.dispose()
      list.resolve(['first'])
      await settle()

      expect(list.queryFn).toHaveBeenCalledTimes(1)
    })
  })
})
