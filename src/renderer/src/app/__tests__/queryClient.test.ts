import {
  dehydrate,
  focusManager,
  hydrate,
  onlineManager,
  QueryClient,
  QueryObserver
} from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOTALS_STALE_TIME_MS } from '@renderer/features/overview/totalsStaleTime'
import { SESSIONS_GC_TIME_MS } from '@renderer/features/sessions/sessionsGcTime'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { LISTS_STALE_TIME_MS } from '../listsStaleTime'
import { PERSIST_MAX_AGE_MS } from '../persistMaxAge'
import { createQueryClient } from '../queryClient'
import { PERSISTED_QUERY_ROOTS } from '../shouldPersistQuery'

const gcTimeOf = (client: QueryClient, queryKey: readonly unknown[]): number =>
  client.getQueryCache().build(client, { queryKey }).gcTime

describe('createQueryClient', () => {
  it('does not refetch on reconnect, since every query is local IPC', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnReconnect).toBe(false)
  })

  it('does not refetch on window focus by default', () => {
    const client = createQueryClient()

    expect(
      client.defaultQueryOptions({ queryKey: ['something-else', 'x'] }).refetchOnWindowFocus
    ).toBe(false)
  })

  it.each([
    ['projects', ['projects']],
    ['sessions', ['sessions', 'x']]
  ])('keeps a %s list fresh for the lists stale time', (_root, queryKey) => {
    expect(createQueryClient().defaultQueryOptions({ queryKey }).staleTime).toBe(
      LISTS_STALE_TIME_MS
    )
  })

  it.each([['projectTotals'], ['projectDailyUsage']])(
    'keeps a folder’s %s fresh for the totals stale time, longer than a list',
    (root) => {
      const { staleTime } = createQueryClient().defaultQueryOptions({
        queryKey: [root, 'x', '7d']
      })

      expect(staleTime).toBe(TOTALS_STALE_TIME_MS)
      expect(TOTALS_STALE_TIME_MS).toBeGreaterThan(LISTS_STALE_TIME_MS)
    }
  )

  describe('on window focus', () => {
    afterEach(() => {
      focusManager.setFocused(undefined)
    })

    /** What one load of the list query returns: its rows, or a failure (`not-found` is a folder that is gone). */
    type Load = readonly unknown[] | 'error' | 'not-found'

    /**
     * Mounts a list query that settles with each of `loads` in turn, ages it, and
     * returns how many times a window focus refetches it. The last load repeats.
     */
    async function refetchesOnFocus(
      queryKey: readonly unknown[],
      loads: readonly Load[]
    ): Promise<number> {
      const client = createQueryClient()
      // A client only listens to the focus manager while mounted, as the provider mounts it.
      client.mount()
      let calls = 0
      const observer = new QueryObserver(client, {
        queryKey,
        retry: false,
        queryFn: () => {
          const load = loads[Math.min(calls, loads.length - 1)]
          calls += 1
          if (load === 'error') return Promise.reject(new Error('boom'))
          if (load === 'not-found') return Promise.reject(new IpcCallError('not-found'))
          return Promise.resolve(load)
        }
      })
      const unsubscribe = observer.subscribe(() => undefined)
      await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
      for (let reload = 1; reload < loads.length; reload += 1) {
        await client.refetchQueries({ queryKey })
      }
      client.getQueryCache().find({ queryKey })?.invalidate()
      const callsBeforeFocus = calls

      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
      unsubscribe()
      client.unmount()
      return calls - callsBeforeFocus
    }

    const listKeys = [
      ['projects', ['projects']],
      ['sessions', ['sessions', 'x']]
    ] as const

    describe.each(listKeys)('a stale %s list', (_root, queryKey) => {
      it('refetches when it loaded rows', async () => {
        expect(await refetchesOnFocus(queryKey, [['row']])).toBe(1)
      })

      it('refetches when it loaded no rows', async () => {
        expect(await refetchesOnFocus(queryKey, [[]])).toBe(1)
      })

      it('refetches when its last load failed and it still has rows', async () => {
        expect(await refetchesOnFocus(queryKey, [['row'], 'error'])).toBe(1)
      })

      it('waits for an explicit retry when it failed and never loaded', async () => {
        expect(await refetchesOnFocus(queryKey, ['error'])).toBe(0)
      })
    })

    describe.each([['projectTotals'], ['projectDailyUsage']])('a stale folder’s %s', (root) => {
      const key = [root, 'x', '7d']

      it('refetches when it loaded', async () => {
        expect(await refetchesOnFocus(key, [['total']])).toBe(1)
      })

      it('refetches when its last load failed and it still has totals', async () => {
        expect(await refetchesOnFocus(key, [['total'], 'error'])).toBe(1)
      })

      it.each(['error', 'not-found'] as const)(
        'refetches when it failed with %s and never loaded, since no screen holds a Retry',
        async (failure) => {
          expect(await refetchesOnFocus(key, [failure])).toBe(1)
        }
      )
    })

    it('waits for an explicit retry when a projects list failed and has no rows, since the gate shows an error', async () => {
      expect(await refetchesOnFocus(['projects'], [[], 'error'])).toBe(0)
    })

    it('refetches when a sessions list failed and has no rows, since the page shows its empty state', async () => {
      expect(await refetchesOnFocus(['sessions', 'x'], [[], 'error'])).toBe(1)
    })

    it.each([
      ['rows', [['row'], 'not-found']],
      ['no rows', [[], 'not-found']]
    ] as const)(
      'waits for an explicit retry when a sessions list that held %s found its folder gone, since the page shows an alert',
      async (_label, loads) => {
        expect(await refetchesOnFocus(['sessions', 'x'], loads)).toBe(0)
      }
    )
  })

  it('leaves the default gcTime alone, so a query outside the persisted roots uses the stock one', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().queries?.gcTime).toBeUndefined()
    expect(gcTimeOf(client, ['something-else', 'x'])).toBe(
      gcTimeOf(new QueryClient(), ['something-else', 'x'])
    )
    expect(gcTimeOf(client, ['something-else', 'x'])).not.toBe(PERSIST_MAX_AGE_MS)
  })

  it.each(PERSISTED_QUERY_ROOTS.filter((root) => root !== 'sessions'))(
    'keeps a %s query as long as the persister keeps it',
    (root) => {
      expect(gcTimeOf(createQueryClient(), [root, 'x'])).toBe(PERSIST_MAX_AGE_MS)
    }
  )

  it('keeps a sessions query only briefly after nothing shows it', () => {
    expect(gcTimeOf(createQueryClient(), ['sessions', 'x'])).toBe(SESSIONS_GC_TIME_MS)
  })

  it('keeps a sessions query restored from the persisted cache only briefly too', () => {
    const saved = new QueryClient()
    saved.setQueryData(['sessions', 'x'], [])
    const client = createQueryClient()

    hydrate(client, dehydrate(saved))

    expect(client.getQueryCache().find({ queryKey: ['sessions', 'x'] })?.gcTime).toBe(
      SESSIONS_GC_TIME_MS
    )
  })

  describe('while the OS reports offline', () => {
    afterEach(() => {
      onlineManager.setOnline(true)
    })

    it('still runs a query, since every query is a local IPC call', async () => {
      onlineManager.setOnline(false)
      const client = createQueryClient()

      const data = await new Promise((resolve) => {
        const observer = new QueryObserver(client, {
          queryKey: ['projects'],
          queryFn: () => Promise.resolve('loaded')
        })
        const unsubscribe = observer.subscribe((result) => {
          if (result.isSuccess) {
            unsubscribe()
            resolve(result.data)
          }
        })
      })

      expect(data).toBe('loaded')
    })
  })

  describe('retry', () => {
    const retry = (failureCount: number, error: Error): boolean => {
      const rule = createQueryClient().getDefaultOptions().queries?.retry
      if (typeof rule !== 'function') throw new Error('retry is not a function')
      return rule(failureCount, error)
    }

    it.each(['unreadable', 'not-found', 'invalid-request', 'untrusted-sender'] as const)(
      'does not retry a %s error',
      (code) => {
        expect(retry(0, new IpcCallError(code))).toBe(false)
      }
    )

    it('retries another IPC error three times, as TanStack does by default', () => {
      const error = new IpcCallError('internal')

      expect([0, 1, 2, 3].map((failures) => retry(failures, error))).toEqual([
        true,
        true,
        true,
        false
      ])
    })

    it('retries an error that is not an IpcCallError', () => {
      expect(retry(0, new Error('boom'))).toBe(true)
    })
  })
})
