import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { testDetail } from '../testSessionDetail'
import { useSessionDetail } from '../useSessionDetail'

const REF: SessionRefDto = {
  projectDirName: '-p',
  sessionId: '11111111-1111-4111-8111-111111111111'
}

describe('useSessionDetail', () => {
  it('loads the detail of the session named by the ref', async () => {
    const detail = testDetail()
    const api = installBeekeeperApi({
      getSession: () => Promise.resolve({ ok: true, value: detail })
    })

    const { result } = renderHook(() => useSessionDetail(REF), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.data).toEqual(detail)
    })
    expect(api.getSession).toHaveBeenCalledExactlyOnceWith(REF.projectDirName, REF.sessionId)
  })

  it('fails with an IpcCallError carrying the failure code', async () => {
    installBeekeeperApi({
      getSession: () => Promise.resolve({ ok: false, error: { code: 'not-found' } })
    })

    const { result } = renderHook(() => useSessionDetail(REF), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(IpcCallError)
    expect(IpcCallError.codeOf(result.current.error)).toBe('not-found')
  })

  it('reuses the loaded detail for a second reader within the stale time', async () => {
    const api = installBeekeeperApi({
      getSession: () => Promise.resolve({ ok: true, value: testDetail() })
    })
    const wrapper = createQueryWrapper(createTestQueryClient())
    const first = renderHook(() => useSessionDetail(REF), { wrapper })
    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true)
    })

    const second = renderHook(() => useSessionDetail(REF), { wrapper })

    expect(second.result.current.isSuccess).toBe(true)
    expect(api.getSession).toHaveBeenCalledTimes(1)
  })

  describe('with cached detail past its stale time', () => {
    const seedStale = (client: ReturnType<typeof createTestQueryClient>): void => {
      client.setQueryData(['session', REF.projectDirName, REF.sessionId], testDetail(), {
        updatedAt: Date.now() - 2 * LISTS_STALE_TIME_MS
      })
    }

    it('refetches when a new reader mounts', async () => {
      const api = installBeekeeperApi({
        getSession: () => Promise.resolve({ ok: true, value: testDetail() })
      })
      const client = createTestQueryClient()
      seedStale(client)

      renderHook(() => useSessionDetail(REF), { wrapper: createQueryWrapper(client) })

      await waitFor(() => {
        expect(api.getSession).toHaveBeenCalledTimes(1)
      })
    })

    it('does not refetch when a new reader opts out of refetching on mount', async () => {
      const api = installBeekeeperApi({
        getSession: () => Promise.resolve({ ok: true, value: testDetail() })
      })
      const client = createTestQueryClient()
      seedStale(client)

      const { result } = renderHook(() => useSessionDetail(REF, { refetchOnMount: false }), {
        wrapper: createQueryWrapper(client)
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(result.current.isSuccess).toBe(true)
      expect(api.getSession).not.toHaveBeenCalled()
    })
  })

  it('still loads a detail that is not cached when the reader opts out of refetching on mount', async () => {
    const detail = testDetail()
    const api = installBeekeeperApi({
      getSession: () => Promise.resolve({ ok: true, value: detail })
    })

    const { result } = renderHook(() => useSessionDetail(REF, { refetchOnMount: false }), {
      wrapper: createQueryWrapper()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(detail)
    })
    expect(api.getSession).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['session', { ...REF, sessionId: '22222222-2222-4222-8222-222222222222' }],
    ['folder', { ...REF, projectDirName: '-other' }]
  ])('keeps a cache entry for each %s', async (_label, other) => {
    const api = installBeekeeperApi({
      getSession: () => Promise.resolve({ ok: true, value: testDetail() })
    })
    const wrapper = createQueryWrapper()

    const first = renderHook(() => useSessionDetail(REF), { wrapper })
    const second = renderHook(() => useSessionDetail(other), { wrapper })
    await waitFor(() => {
      expect(first.result.current.isSuccess && second.result.current.isSuccess).toBe(true)
    })

    expect(api.getSession).toHaveBeenCalledTimes(2)
  })
})
