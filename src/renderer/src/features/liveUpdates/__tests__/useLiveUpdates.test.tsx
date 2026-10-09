import { IsRestoringProvider, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilesChangedDto } from '../../../../../shared/ipc/filesChangedDto'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { useLiveUpdates } from '../useLiveUpdates'
import { useLiveUpdatesStore } from '../state/useLiveUpdatesStore'

const A = '-Users-a-repo'
const B = '-Users-b-other'
const change = (dirNames: string[]): FilesChangedDto => ({
  dirNames,
  foldersChanged: false,
  all: false
})

let client: QueryClient
let api: TestBeekeeperApi
let restoring: boolean
let unsubscribers: (() => void)[]

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <QueryClientProvider client={client}>
      <IsRestoringProvider value={restoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  )
}

/** Keeps a seeded, fresh query on screen and returns its query function. */
function showing(queryKey: readonly unknown[]): ReturnType<typeof vi.fn> {
  client.setQueryData(queryKey, ['seed'])
  const queryFn = vi.fn(() => Promise.resolve(['fresh']))
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn,
    staleTime: Infinity,
    refetchOnMount: false
  })
  unsubscribers.push(observer.subscribe(() => undefined))
  return queryFn
}

beforeEach(() => {
  client = createTestQueryClient()
  api = installBeekeeperApi()
  restoring = false
  unsubscribers = []
})

afterEach(() => {
  for (const unsubscribe of unsubscribers) unsubscribe()
  client.clear()
  useLiveUpdatesStore.setState({ paused: false, unavailable: false })
})

describe('useLiveUpdates', () => {
  it('refetches the visible lists of a changed family', async () => {
    const list = showing(['sessions', A])
    const other = showing(['sessions', B])
    renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )

    act(() => {
      api.fireFilesChanged(change([A]))
    })

    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1)
    })
    expect(other).not.toHaveBeenCalled()
  })

  it('ignores changes while paused', async () => {
    const list = showing(['sessions', A])
    renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )
    act(() => {
      useLiveUpdatesStore.getState().setPaused(true)
    })

    act(() => {
      api.fireFilesChanged(change([A]))
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(list).not.toHaveBeenCalled()
  })

  it('refreshes everything visible once when live updates resume', async () => {
    const list = showing(['sessions', A])
    const other = showing(['sessions', B])
    renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )
    act(() => {
      useLiveUpdatesStore.getState().setPaused(true)
    })
    act(() => {
      api.fireFilesChanged(change([A]))
    })

    act(() => {
      useLiveUpdatesStore.getState().setPaused(false)
    })

    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1)
      expect(other).toHaveBeenCalledTimes(1)
    })
  })

  it('does not refresh when pausing', async () => {
    const list = showing(['sessions', A])
    renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )

    act(() => {
      useLiveUpdatesStore.getState().setPaused(true)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(list).not.toHaveBeenCalled()
  })

  it('records that live updates are unavailable', () => {
    renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )

    act(() => {
      api.fireLiveUpdatesUnavailable()
    })

    expect(useLiveUpdatesStore.getState().unavailable).toBe(true)
  })

  it('stops listening when it unmounts', async () => {
    const list = showing(['sessions', A])
    const { unmount } = renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )
    unmount()

    api.fireFilesChanged(change([A]))
    api.fireLiveUpdatesUnavailable()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(list).not.toHaveBeenCalled()
    expect(useLiveUpdatesStore.getState().unavailable).toBe(false)
  })

  it('does not catch up on a resume after it unmounts', async () => {
    const list = showing(['sessions', A])
    const { unmount } = renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )
    act(() => {
      useLiveUpdatesStore.getState().setPaused(true)
    })
    unmount()

    act(() => {
      useLiveUpdatesStore.getState().setPaused(false)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(list).not.toHaveBeenCalled()
  })

  it('keeps one subscription across a pause and a resume', () => {
    renderHook(
      () => {
        useLiveUpdates()
      },
      { wrapper }
    )

    act(() => {
      useLiveUpdatesStore.getState().setPaused(true)
    })
    act(() => {
      useLiveUpdatesStore.getState().setPaused(false)
    })

    expect(api.onFilesChanged).toHaveBeenCalledTimes(1)
  })

  describe('while the persisted cache is restoring', () => {
    it('ignores changes', async () => {
      restoring = true
      const list = showing(['sessions', A])
      renderHook(
        () => {
          useLiveUpdates()
        },
        { wrapper }
      )

      act(() => {
        api.fireFilesChanged(change([A]))
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(list).not.toHaveBeenCalled()
    })

    it('starts applying changes once restoring has finished', async () => {
      restoring = true
      const list = showing(['sessions', A])
      const { rerender } = renderHook(
        () => {
          useLiveUpdates()
        },
        { wrapper }
      )

      restoring = false
      rerender()
      act(() => {
        api.fireFilesChanged(change([A]))
      })

      await vi.waitFor(() => {
        expect(list).toHaveBeenCalledTimes(1)
      })
    })

    it('still records that live updates are unavailable', () => {
      restoring = true
      renderHook(
        () => {
          useLiveUpdates()
        },
        { wrapper }
      )

      act(() => {
        api.fireLiveUpdatesUnavailable()
      })

      expect(useLiveUpdatesStore.getState().unavailable).toBe(true)
    })
  })
})
