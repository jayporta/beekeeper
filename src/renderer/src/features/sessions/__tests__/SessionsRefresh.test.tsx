import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { registerWindowFocusRefetch } from '@renderer/app/windowFocusRefetch'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { installBeekeeperApi, testProject, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import App from '@renderer/App'
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
  useSessionsViewStore.setState({ query: '', expanded: new Set() })
  unregisterFocus = registerWindowFocusRefetch()
})

afterEach(async () => {
  unregisterFocus()
  vi.useRealTimers()
  await resetPersistedState()
})

/** Renders the app with the given `listSessions` and waits for the first list. */
async function showSessions(
  listSessions: () => Promise<SessionsResult>,
  projects = [testProject(DIR)]
): Promise<TestBeekeeperApi> {
  const api = installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: projects }),
    listSessions
  })
  render(<App />, { wrapper: createQueryWrapper() })
  await screen.findByRole('rowheader', { name: /Refactor parser/ })
  return api
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
  it('shows a session that appeared, and keeps a lead expanded, after the stale time', async () => {
    let current = [lead, mate]
    await showSessions(() => loaded(current))
    await userEvent.click(
      await screen.findByRole('button', { name: '1 teammate of Refactor parser' })
    )
    current = [lead, mate, added]

    await focusAfterStaleTime()

    expect(await screen.findByRole('rowheader', { name: /Brand new session/ })).toBeTruthy()
    expect(screen.queryByRole('rowheader', { name: /^reviewer/ })).not.toBeNull()
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
    await screen.findByRole('rowheader', { name: /Refactor tests/ })

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
    const picker = (await screen.findByRole('combobox', { name: 'Project' })) as HTMLSelectElement
    await userEvent.selectOptions(picker, OTHER)
    expect(picker.value).toBe(OTHER)
    otherGone = true

    await focusAfterStaleTime()

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Project' }) as HTMLSelectElement).value).toBe(
        DIR
      )
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
})
