import {
  dehydrate,
  hydrate,
  onlineManager,
  QueryClient,
  QueryObserver
} from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { SESSIONS_GC_TIME_MS } from '@renderer/features/sessions/sessionsGcTime'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { PERSIST_MAX_AGE_MS } from '../persistMaxAge'
import { createQueryClient } from '../queryClient'
import { PERSISTED_QUERY_ROOTS } from '../shouldPersistQuery'

const gcTimeOf = (client: QueryClient, queryKey: readonly unknown[]): number =>
  client.getQueryCache().build(client, { queryKey }).gcTime

describe('createQueryClient', () => {
  it('does not refetch on window focus or reconnect', () => {
    const { queries } = createQueryClient().getDefaultOptions()

    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(queries?.refetchOnReconnect).toBe(false)
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
