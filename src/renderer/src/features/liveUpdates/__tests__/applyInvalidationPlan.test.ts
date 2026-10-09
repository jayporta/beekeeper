import { QueryObserver, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { testProject } from '@renderer/testBeekeeperApi'
import { applyInvalidationPlan } from '../applyInvalidationPlan'
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

let client: QueryClient
let unsubscribers: (() => void)[]

beforeEach(() => {
  client = createTestQueryClient()
  unsubscribers = []
})

afterEach(() => {
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

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('applyInvalidationPlan', () => {
  it('refetches the visible session list and detail of a changed family', async () => {
    const list = showing(['sessions', A])
    const detail = showing(['session', A, SESSION])

    applyInvalidationPlan(client, planFor([A]))

    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1)
      expect(detail).toHaveBeenCalledTimes(1)
    })
  })

  it('leaves another family alone', async () => {
    const otherList = showing(['sessions', B])
    const otherDetail = showing(['session', B, SESSION])

    applyInvalidationPlan(client, planFor([A]))
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

    applyInvalidationPlan(client, planFor([A]))

    await vi.waitFor(() => {
      expect(worktreeList).toHaveBeenCalledTimes(1)
    })
  })

  it('does not refetch a session list nothing shows', async () => {
    client.setQueryData(['sessions', A], ['seed'])
    const queryFn = vi.fn(() => Promise.resolve(['fresh']))
    client.setQueryDefaults(['sessions', A], { queryFn })

    applyInvalidationPlan(client, planFor([A]))
    await settle()

    expect(queryFn).not.toHaveBeenCalled()
    expect(client.getQueryState(['sessions', A])?.isInvalidated).toBe(true)
  })

  it('marks a changed folder’s totals and daily usage stale without refetching them', async () => {
    const totals = showing(['projectTotals', A, '7d'])
    const usage = showing(['projectDailyUsage', A, '7d', '2026-10-08'])

    applyInvalidationPlan(client, planFor([A]))
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

    applyInvalidationPlan(client, planFor([A]))
    await settle()

    expect(client.getQueryState(['projectTotals', B, '7d'])?.isInvalidated).toBe(false)
  })

  it('leaves worktree diffs and patches alone', async () => {
    const diffs = showing(['worktreeDiffs', A, SESSION])
    const patch = showing(['worktreePatch', A, SESSION, 'agent'])

    applyInvalidationPlan(client, ALL)
    await settle()

    expect(diffs).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
  })

  it('refetches the project list only when the plan says so', async () => {
    const projects = showing(['projects'])

    applyInvalidationPlan(client, planFor([A]))
    await settle()
    expect(projects).not.toHaveBeenCalled()

    applyInvalidationPlan(client, { ...planFor([A]), projects: true })
    await vi.waitFor(() => {
      expect(projects).toHaveBeenCalledTimes(1)
    })
  })

  it('refetches every visible list and detail for an all plan', async () => {
    const list = showing(['sessions', A])
    const otherDetail = showing(['session', B, SESSION])

    applyInvalidationPlan(client, ALL)

    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1)
      expect(otherDetail).toHaveBeenCalledTimes(1)
    })
  })

  it('lets a refetch already in flight finish instead of restarting it', async () => {
    client.setQueryData(['sessions', A], ['seed'])
    let finishFirst: (rows: string[]) => void = () => undefined
    const queryFn = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          finishFirst = resolve
        })
    )
    // Stale seeded data, so subscribing starts a refetch that is still running.
    const observer = new QueryObserver(client, { queryKey: ['sessions', A], queryFn, staleTime: 0 })
    unsubscribers.push(observer.subscribe(() => undefined))
    await vi.waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1)
    })

    applyInvalidationPlan(client, planFor([A]))
    await settle()
    finishFirst(['first'])

    await vi.waitFor(() => {
      expect(client.getQueryData(['sessions', A])).toEqual(['first'])
    })
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  describe('a query showing an error screen', () => {
    it('leaves a failed session list with no data alone', async () => {
      const queryFn = await showingFailure(['sessions', A], { error: new IpcCallError('internal') })

      applyInvalidationPlan(client, planFor([A]))
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('leaves a list whose folder is gone alone, even with data', async () => {
      const queryFn = await showingFailure(['sessions', A], {
        error: new IpcCallError('not-found'),
        data: ['stale']
      })

      applyInvalidationPlan(client, planFor([A]))
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('leaves a failed session detail with no data alone', async () => {
      const queryFn = await showingFailure(['session', A, SESSION], {
        error: new IpcCallError('internal')
      })

      applyInvalidationPlan(client, planFor([A]))
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('leaves a failed project list with no projects alone', async () => {
      const queryFn = await showingFailure(['projects'], { error: new IpcCallError('internal') })

      applyInvalidationPlan(client, { ...planFor([A]), projects: true })
      await settle()

      expect(queryFn).not.toHaveBeenCalled()
    })

    it('refetches a failed list that still shows its data', async () => {
      const queryFn = await showingFailure(['sessions', A], {
        error: new IpcCallError('internal'),
        data: ['stale']
      })

      applyInvalidationPlan(client, planFor([A]))

      await vi.waitFor(() => {
        expect(queryFn).toHaveBeenCalledTimes(1)
      })
    })

    it('refetches a failed session detail that still shows its data', async () => {
      const queryFn = await showingFailure(['session', A, SESSION], {
        error: new IpcCallError('internal'),
        data: { stale: true }
      })

      applyInvalidationPlan(client, planFor([A]))

      await vi.waitFor(() => {
        expect(queryFn).toHaveBeenCalledTimes(1)
      })
    })
  })
})
