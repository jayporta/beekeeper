import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IpcErrorCode } from '../../../../../shared/ipc/ipcResult'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { SessionDetailStatus } from '../SessionDetailStatus'

afterEach(() => {
  vi.useRealTimers()
  useNavigationStore.getState().reset()
})

/** A status for a load that failed with `code` at `errorUpdatedAt`, or one still loading when `code` is `null`. */
function status(
  code: IpcErrorCode | null,
  options: { errorUpdatedAt?: number; holdNotFound?: boolean } = {}
): React.JSX.Element {
  const { errorUpdatedAt = 1, holdNotFound = false } = options
  return (
    <SessionDetailStatus
      error={code === null ? null : new IpcCallError(code)}
      errorUpdatedAt={errorUpdatedAt}
      holdNotFound={holdNotFound}
      onRetry={() => undefined}
    />
  )
}

describe('SessionDetailStatus for a missing session', () => {
  it('names its message group by the heading and describes it by the body', () => {
    render(status('not-found'))

    expect(
      screen.getByRole('group', {
        name: 'Session not found',
        description: "beekeeper can't find this session. It may have been deleted."
      })
    ).toBeTruthy()
  })

  it('is not a live region itself', () => {
    render(status('not-found'))

    expect(screen.getByRole('group').closest('[role="alert"], [role="status"]')).toBeNull()
  })

  it('announces itself with a separate hidden alert when nothing lost focus', () => {
    render(status('not-found'))

    expect(screen.getByRole('alert').textContent).toContain('Session not found')
  })

  it('announces a repeated failure again with a fresh alert', () => {
    const { rerender } = render(status('not-found', { errorUpdatedAt: 1 }))
    const first = screen.getByRole('alert')

    rerender(status('not-found', { errorUpdatedAt: 2 }))

    expect(screen.getByRole('alert')).not.toBe(first)
    expect(first.isConnected).toBe(false)
  })

  it('removes its alert once the live copy delay has passed, and keeps the message', () => {
    vi.useFakeTimers()
    render(status('not-found'))

    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS)
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('moves focus to the message, with no alert, when it replaces the focused control', () => {
    const { rerender } = render(status('unreadable'))
    screen.getByRole('button', { name: 'Retry' }).focus()

    rerender(status('not-found'))

    expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Session not found' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows loading in its place while the folder’s list can still say the folder is gone', () => {
    render(status('not-found', { holdNotFound: true }))

    expect(screen.getByRole('heading', { level: 1, name: 'Loading session' })).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the message, and announces it, once the hold ends', () => {
    const { rerender } = render(status('not-found', { holdNotFound: true }))

    rerender(status('not-found'))

    expect(screen.getByRole('group', { name: 'Session not found' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Session not found')
  })

  it('goes back to the sessions list', async () => {
    useNavigationStore.getState().showSession({ projectDirName: 'a', sessionId: 'b' })
    render(status('not-found'))

    await userEvent.click(screen.getByRole('button', { name: 'Back to sessions' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
  })
})

describe('SessionDetailStatus for other states', () => {
  it('says it is loading while the load runs, even when a not-found is held', () => {
    render(status(null, { holdNotFound: true }))

    expect(screen.getByRole('status').textContent).toContain('Loading session')
  })

  it('does not hold a failure that is not a not-found', () => {
    render(status('unreadable', { holdNotFound: true }))

    expect(screen.getByRole('alert').textContent).toContain("Can't read this session")
  })
})
