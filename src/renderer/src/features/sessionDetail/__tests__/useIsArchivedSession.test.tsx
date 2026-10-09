import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { testDetail } from '../testSessionDetail'
import { useIsArchivedSession } from '../useIsArchivedSession'

const REF: SessionRefDto = {
  projectDirName: '-p',
  sessionId: '11111111-1111-4111-8111-111111111111'
}
const KEY = ['session', REF.projectDirName, REF.sessionId]

describe('useIsArchivedSession', () => {
  it('is false when the session detail is not cached, and loads nothing', () => {
    const api = installBeekeeperApi()

    const { result } = renderHook(() => useIsArchivedSession(REF), {
      wrapper: createQueryWrapper()
    })

    expect(result.current).toBe(false)
    expect(api.getSession).not.toHaveBeenCalled()
  })

  it('is false for a cached detail read from disk', () => {
    installBeekeeperApi()
    const client = createTestQueryClient()
    client.setQueryData(KEY, testDetail())

    const { result } = renderHook(() => useIsArchivedSession(REF), {
      wrapper: createQueryWrapper(client)
    })

    expect(result.current).toBe(false)
  })

  it('is true for a cached archived detail', () => {
    installBeekeeperApi()
    const client = createTestQueryClient()
    client.setQueryData(KEY, testDetail({ archived: true }))

    const { result } = renderHook(() => useIsArchivedSession(REF), {
      wrapper: createQueryWrapper(client)
    })

    expect(result.current).toBe(true)
  })

  it('follows the cached detail when it refetches into the archived state', async () => {
    installBeekeeperApi()
    const client = createTestQueryClient()
    client.setQueryData(KEY, testDetail())
    const { result } = renderHook(() => useIsArchivedSession(REF), {
      wrapper: createQueryWrapper(client)
    })

    act(() => {
      client.setQueryData(KEY, testDetail({ archived: true }))
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('reads the detail of the session it is given, not another', () => {
    installBeekeeperApi()
    const client = createTestQueryClient()
    client.setQueryData(
      ['session', '-p', '22222222-2222-4222-8222-222222222222'],
      testDetail({ archived: true })
    )

    const { result } = renderHook(() => useIsArchivedSession(REF), {
      wrapper: createQueryWrapper(client)
    })

    expect(result.current).toBe(false)
  })
})
