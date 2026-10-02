import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useProjects } from '@renderer/features/projects/useProjects'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { useRefreshLists } from '../useRefreshLists'
import { useSessions } from '../useSessions'

const DIR = '-p'
type SessionsResult = IpcResult<readonly SessionListItemDto[]>

/** Renders the two list queries beside the hook, as the sessions view does. */
function renderRefresh(listSessions: () => Promise<SessionsResult>): {
  api: ReturnType<typeof installBeekeeperApi>
  result: { current: ReturnType<typeof useRefreshLists> }
} {
  const api = installBeekeeperApi({ listSessions })
  const { result } = renderHook(
    () => {
      useProjects()
      useSessions(DIR)
      return useRefreshLists(DIR)
    },
    { wrapper: createQueryWrapper() }
  )
  return { api, result }
}

const emptyList = (): Promise<SessionsResult> => Promise.resolve({ ok: true, value: [] })

describe('useRefreshLists', () => {
  it('starts idle', () => {
    const { result } = renderRefresh(emptyList)

    expect(result.current.status).toBe('idle')
  })

  it('refetches the project list and the folder session list, however fresh they are', async () => {
    const { api, result } = renderRefresh(emptyList)
    await waitFor(() => {
      expect(api.listSessions).toHaveBeenCalledTimes(1)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('refreshed')
    })
    expect(api.listProjects).toHaveBeenCalledTimes(2)
    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('reports refreshing until the lists settle, then refreshed', async () => {
    let release: () => void = () => undefined
    let calls = 0
    const { result } = renderRefresh(() => {
      calls += 1
      if (calls === 1) return emptyList()
      return new Promise((resolve) => {
        release = () => {
          resolve({ ok: true, value: [] })
        }
      })
    })
    await waitFor(() => {
      expect(calls).toBe(1)
    })

    act(() => {
      result.current.refresh()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('refreshing')
    })
    await act(async () => {
      release()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('refreshed')
    })
  })

  it('makes one call to a list that is already loading, when refreshed twice', async () => {
    let calls = 0
    const { result } = renderRefresh(() => {
      calls += 1
      return emptyList()
    })
    await waitFor(() => {
      expect(calls).toBe(1)
    })

    act(() => {
      result.current.refresh()
      result.current.refresh()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('refreshed')
    })

    expect(calls).toBe(2)
  })

  it('reports failed when a list fails to load', async () => {
    let calls = 0
    const { result } = renderRefresh(() => {
      calls += 1
      if (calls === 1) return emptyList()
      return Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    })
    await waitFor(() => {
      expect(calls).toBe(1)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('failed')
    })
  })

  it('clears a failure when refreshed again, and reports refreshed once the lists load', async () => {
    let calls = 0
    const { result } = renderRefresh(() => {
      calls += 1
      if (calls === 2) return Promise.resolve({ ok: false, error: { code: 'unreadable' } })
      return emptyList()
    })
    await waitFor(() => {
      expect(calls).toBe(1)
    })
    act(() => {
      result.current.refresh()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('failed')
    })

    act(() => {
      result.current.refresh()
    })
    expect(result.current.status).toBe('refreshing')

    await waitFor(() => {
      expect(result.current.status).toBe('refreshed')
    })
  })
})
