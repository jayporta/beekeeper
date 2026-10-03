import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { registerWindowFocusRefetch } from '@renderer/app/windowFocusRefetch'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { installBeekeeperApi, testProject, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import App from '@renderer/App'
import { STATUS_ANNOUNCE_DELAY_MS } from '../statusAnnounceDelay'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'

const DIR = '-Users-a-repo'
const OTHER = '-Users-a-other'

type SessionsResult = IpcResult<readonly SessionListItemDto[]>

const lead = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  latestMs: Date.parse('2026-01-15T12:00:00Z'),
  team: testLeadTeam([testRef(2, DIR)])
})
const mate = testSession(2, {
  projectDirName: DIR,
  role: testAgentRole('reviewer', 'code'),
  team: testTeammateTeam(testRef(1, DIR))
})
const added = testSession(3, { projectDirName: DIR, title: 'Brand new session' })

const loaded = (value: readonly SessionListItemDto[]): Promise<SessionsResult> =>
  Promise.resolve({ ok: true, value })

/** A `listSessions` result a test settles itself, so a refetch can be held in flight. */
function deferred(): { promise: Promise<SessionsResult>; settle: (r: SessionsResult) => void } {
  let settle: (r: SessionsResult) => void = () => undefined
  const promise = new Promise<SessionsResult>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

let unregisterFocus: () => void

beforeEach(() => {
  // Only the clock is faked, so a test can age the lists without waiting.
  vi.useFakeTimers({ toFake: ['Date'] })
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
  unregisterFocus = registerWindowFocusRefetch()
})

afterEach(async () => {
  unregisterFocus()
  vi.useRealTimers()
  await resetPersistedState()
})

/**
 * Renders the app with the given list loaders and waits for the first session
 * list. `projects` is a fixed list, or a loader for tests that make the
 * project list fail.
 */
async function showSessions(
  listSessions: (dirName: string) => Promise<SessionsResult>,
  projects: readonly ProjectDto[] | (() => Promise<IpcResult<readonly ProjectDto[]>>) = [
    testProject(DIR)
  ]
): Promise<TestBeekeeperApi> {
  const api = installBeekeeperApi({
    listProjects:
      typeof projects === 'function'
        ? projects
        : () => Promise.resolve({ ok: true, value: projects }),
    listSessions
  })
  render(<App />, { wrapper: createQueryWrapper() })
  await screen.findByRole('heading', { level: 2, name: 'Refactor parser' })
  return api
}

/** The refresh button's status region, the one inside the page heading. */
const refreshStatus = (): HTMLElement | undefined =>
  screen.getAllByRole('status').find((region) => region.closest('header') !== null)

const FAILURE = "Couldn't refresh the lists."

/** The failure note sighted users see, which assistive tech skips. */
const failureNote = (): HTMLElement | null =>
  screen.queryByText(FAILURE, { selector: '[aria-hidden="true"]' })

/** Lets the status region's delayed text arrive, so an assertion on it can fail. */
async function afterAnnounceDelay(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, STATUS_ANNOUNCE_DELAY_MS + 20))
  })
}

/** Ages the lists past their stale time, then focuses the window and lets the refetch start. */
async function focusAfterStaleTime(): Promise<void> {
  vi.advanceTimersByTime(LISTS_STALE_TIME_MS + 1)
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

describe('refreshing the lists on window focus', () => {
  it('shows a session that appeared, and keeps the cards, after the stale time', async () => {
    let current = [lead, mate]
    await showSessions(() => loaded(current))
    current = [lead, mate, added]

    await focusAfterStaleTime()

    expect(await screen.findByRole('heading', { level: 2, name: 'Brand new session' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Refactor parser' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^reviewer \(code\)/ })).toBeTruthy()
  })

  it('makes no second call when the window is focused within the stale time', async () => {
    const api = await showSessions(() => loaded([lead]))

    await act(async () => {
      vi.advanceTimersByTime(LISTS_STALE_TIME_MS - 1)
      window.dispatchEvent(new Event('focus'))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(api.listSessions).toHaveBeenCalledTimes(1)
  })

  it('keeps focus and the typed text in the search box while it refetches', async () => {
    let current = [lead]
    const api = await showSessions(() => loaded(current))
    const search = await screen.findByRole('searchbox', { name: 'Search sessions' })
    await userEvent.type(search, 'Refactor')
    current = [lead, testSession(3, { projectDirName: DIR, title: 'Refactor tests' })]

    await focusAfterStaleTime()
    await screen.findByRole('heading', { level: 2, name: 'Refactor tests' })

    expect(api.listSessions).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search sessions' }))
    expect(
      (screen.getByRole('searchbox', { name: 'Search sessions' }) as HTMLInputElement).value
    ).toBe('Refactor')
  })

  it('resets the selected project when a refetch finds its folder gone', async () => {
    let otherGone = false
    await showSessions(
      () =>
        otherGone ? Promise.resolve({ ok: false, error: { code: 'not-found' } }) : loaded([lead]),
      [testProject(DIR), testProject(OTHER)]
    )
    await userEvent.click(await screen.findByRole('button', { name: OTHER }))
    expect(screen.getByRole('button', { name: OTHER }).getAttribute('aria-current')).toBe('page')
    otherGone = true

    await focusAfterStaleTime()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: DIR }).getAttribute('aria-current')).toBe('page')
    })
  })
})

describe('the Refresh button', () => {
  it('refetches both lists whatever their age, says so while it runs, and keeps focus', async () => {
    const second = deferred()
    let calls = 0
    const api = await showSessions(() => {
      calls += 1
      return calls === 1 ? loaded([lead]) : second.promise
    })
    const button = await screen.findByRole('button', { name: 'Refresh' })

    await userEvent.click(button)

    await screen.findByRole('button', { name: 'Refreshing' })
    expect(api.listProjects).toHaveBeenCalledTimes(2)
    expect(api.listSessions).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Refreshing' }))

    await act(async () => {
      second.settle({ ok: true, value: [lead] })
      await Promise.resolve()
    })
    await screen.findByRole('button', { name: 'Refresh' })
  })

  it('announces that the lists were updated once the refresh settles', async () => {
    await showSessions(() => loaded([lead]))

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain(
        'Lists updated'
      )
    })
  })

  it('makes one call to the session list when pressed twice while the first is pending', async () => {
    const second = deferred()
    let calls = 0
    const api = await showSessions(() => {
      calls += 1
      return calls === 1 ? loaded([lead]) : second.promise
    })
    const button = await screen.findByRole('button', { name: 'Refresh' })

    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Refreshing' }))

    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('reuses a focus refetch already in flight rather than starting another', async () => {
    const second = deferred()
    let calls = 0
    const api = await showSessions(() => {
      calls += 1
      return calls === 1 ? loaded([lead]) : second.promise
    })
    await focusAfterStaleTime()
    expect(api.listSessions).toHaveBeenCalledTimes(2)

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))

    expect(api.listSessions).toHaveBeenCalledTimes(2)
  })

  it('shows and announces a failed refresh, with the button ready again, until a press succeeds', async () => {
    let calls = 0
    await showSessions(() => {
      calls += 1
      return calls === 2
        ? Promise.resolve({ ok: false, error: { code: 'unreadable' } })
        : loaded([lead])
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(failureNote()).not.toBeNull()
    })
    await afterAnnounceDelay()

    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeNull()
    expect(refreshStatus()?.textContent).toBe(FAILURE)

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await afterAnnounceDelay()

    expect(refreshStatus()?.textContent).toBe('Lists updated')
    expect(failureNote()).toBeNull()
  })

  it('gives the project switched to an idle button and an empty status mid-refresh', async () => {
    const pending = deferred()
    let calls = 0
    await showSessions(
      (dirName) => {
        calls += 1
        return dirName === DIR && calls === 2 ? pending.promise : loaded([lead])
      },
      [testProject(DIR), testProject(OTHER)]
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await screen.findByRole('button', { name: 'Refreshing' })

    await userEvent.click(await screen.findByRole('button', { name: OTHER }))

    await screen.findByRole('button', { name: 'Refresh' })
    await afterAnnounceDelay()
    expect(refreshStatus()?.textContent).toBe('')
    expect(failureNote()).toBeNull()
  })

  it('drops the failure note once a later focus refetch loads the lists', async () => {
    let calls = 0
    await showSessions(() => {
      calls += 1
      return calls === 2
        ? Promise.resolve({ ok: false, error: { code: 'unreadable' } })
        : loaded([lead])
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(failureNote()).not.toBeNull()
    })

    await focusAfterStaleTime()
    await afterAnnounceDelay()

    expect(failureNote()).toBeNull()
    expect(refreshStatus()?.textContent).toBe('')
  })

  it('shows and announces a failure when a focus refetch fails on its own, and drops it on a later success', async () => {
    let calls = 0
    await showSessions(() => {
      calls += 1
      return calls === 2
        ? Promise.resolve({ ok: false, error: { code: 'unreadable' } })
        : loaded([lead])
    })

    await focusAfterStaleTime()
    await afterAnnounceDelay()

    expect(calls).toBe(2)
    expect(failureNote()).not.toBeNull()
    expect(refreshStatus()?.textContent).toBe(FAILURE)

    await focusAfterStaleTime()
    await afterAnnounceDelay()

    expect(failureNote()).toBeNull()
    expect(refreshStatus()?.textContent).toBe('')
  })

  it('does not announce the lists updated again after a failure clears', async () => {
    let calls = 0
    await showSessions(() => {
      calls += 1
      return calls === 3
        ? Promise.resolve({ ok: false, error: { code: 'unreadable' } })
        : loaded([lead])
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await afterAnnounceDelay()
    expect(refreshStatus()?.textContent).toBe('Lists updated')
    await focusAfterStaleTime()
    await afterAnnounceDelay()
    expect(refreshStatus()?.textContent).toBe(FAILURE)

    await focusAfterStaleTime()
    await afterAnnounceDelay()

    expect(refreshStatus()?.textContent).toBe('')
  })

  it('shows a failure when the project list fails to reload and the session list does not', async () => {
    let projectCalls = 0
    await showSessions(
      () => loaded([lead]),
      () => {
        projectCalls += 1
        return projectCalls === 2
          ? Promise.resolve({ ok: false, error: { code: 'unreadable' } })
          : Promise.resolve({ ok: true, value: [testProject(DIR)] })
      }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await afterAnnounceDelay()

    expect(refreshStatus()?.textContent).toBe(FAILURE)
  })

  it('shows a failure when a focus refetch of the project list fails, and drops it on a later success', async () => {
    let projectCalls = 0
    await showSessions(
      () => loaded([lead]),
      () => {
        projectCalls += 1
        return projectCalls === 2
          ? Promise.resolve({ ok: false, error: { code: 'unreadable' } })
          : Promise.resolve({ ok: true, value: [testProject(DIR)] })
      }
    )

    await focusAfterStaleTime()
    await afterAnnounceDelay()
    expect(refreshStatus()?.textContent).toBe(FAILURE)

    await focusAfterStaleTime()
    await afterAnnounceDelay()

    expect(refreshStatus()?.textContent).toBe('')
  })

  it('shows the failure again when the retry of a list that never loaded fails', async () => {
    const retry = deferred()
    let calls = 0
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () => {
        calls += 1
        return calls === 3
          ? retry.promise
          : Promise.resolve({ ok: false, error: { code: 'unreadable' } })
      }
    })
    render(<App />, { wrapper: createQueryWrapper() })
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(failureNote()).not.toBeNull()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await afterAnnounceDelay()

    expect(calls).toBe(3)
    // The retry has no list to show yet, so the page says it is loading instead.
    expect(failureNote()).toBeNull()
    expect(refreshStatus()?.textContent).toBe('')
    await act(async () => {
      retry.settle({ ok: false, error: { code: 'unreadable' } })
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    await afterAnnounceDelay()
    expect(failureNote()).not.toBeNull()
    expect(refreshStatus()?.textContent).toBe(FAILURE)
  })
})
