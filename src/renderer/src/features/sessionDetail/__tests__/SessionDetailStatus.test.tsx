import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcErrorCode } from '../../../../../shared/ipc/ipcResult'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { SessionDetailStatus } from '../SessionDetailStatus'

afterEach(() => {
  useNavigationStore.getState().reset()
})

/** A status for a load that failed with `code` at `errorUpdatedAt`, or one still loading when `code` is `null`. */
function status(
  code: IpcErrorCode | null,
  options: { errorUpdatedAt?: number; holdNotFound?: boolean; summaryOnly?: boolean } = {}
): React.JSX.Element {
  const { errorUpdatedAt = 1, holdNotFound = false, summaryOnly = false } = options
  return (
    <SessionDetailStatus
      error={code === null ? null : new IpcCallError(code)}
      errorUpdatedAt={errorUpdatedAt}
      holdNotFound={holdNotFound}
      summaryOnly={summaryOnly}
      onRetry={() => undefined}
    />
  )
}

describe('SessionDetailStatus for an archived session with a summary only', () => {
  it('names its group by the summary-only heading and describes it by the body', () => {
    render(status('not-found', { summaryOnly: true }))

    expect(
      screen.getByRole('group', {
        name: 'Only a summary was archived',
        description:
          /^beekeeper archived this session's summary, shown above, but not its full detail/
      })
    ).toBeTruthy()
  })

  it('puts its heading under the page heading, not as a second h1', () => {
    render(status('not-found', { summaryOnly: true }))

    expect(
      screen.getByRole('heading', { level: 2, name: 'Only a summary was archived' })
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('goes back to the sessions list', async () => {
    useNavigationStore.getState().showSession({ projectDirName: 'p', sessionId: 's' })
    render(status('not-found', { summaryOnly: true }))

    await userEvent.click(screen.getByRole('button', { name: 'Back to sessions' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('leaves other failures as they are', () => {
    render(status('unreadable', { summaryOnly: true }))

    expect(screen.getByRole('alert').textContent).toContain("Can't read this session")
  })
})

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
