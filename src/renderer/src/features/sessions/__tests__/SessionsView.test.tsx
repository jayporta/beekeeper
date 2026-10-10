import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { SessionsContent } from '../SessionsContent'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import {
  testAgentRole,
  testUsage,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'

const DIR = '-Users-a-repo'
const ok = (
  value: readonly SessionListItemDto[]
): Promise<IpcResult<readonly SessionListItemDto[]>> => Promise.resolve({ ok: true, value })

const lead = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  latestMs: Date.parse('2026-01-15T12:00:00Z'),
  earliestMs: Date.parse('2026-01-15T11:00:00Z'),
  model: 'claude-opus-5',
  team: testLeadTeam(
    [testRef(2, DIR), testRef(3, '-Users-a-other')],
    testUsage({ missingTeammates: 1 })
  )
})
const mateA = testSession(2, {
  projectDirName: DIR,
  role: testAgentRole('reviewer', 'code'),
  team: testTeammateTeam(testRef(1, DIR), true)
})
const mateB = testSession(3, {
  projectDirName: '-Users-a-other',
  role: testAgentRole('writer', 'code'),
  team: testTeammateTeam(testRef(1, DIR))
})
const solo = testSession(4, { projectDirName: DIR, latestMs: 1, costUSD: 0.004 })
const SESSIONS = [lead, mateA, mateB, solo]

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
})

afterEach(resetPersistedState)

function showSessions(sessions: readonly SessionListItemDto[] = SESSIONS): void {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
    listSessions: () => ok(sessions)
  })
  renderApp()
}

describe('SessionsView search', () => {
  it('says so when nothing matches', async () => {
    showSessions()
    await screen.findByRole('list', { name: DIR })

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'zzz')

    expect(screen.getByRole('heading', { name: 'No matching sessions' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: DIR })).toBeNull()
  })
})

/**
 * The search results live region: the last status region with no heading of its
 * own, outside the page heading, which holds the refresh button's status. The
 * gone-folder region is another one, mounted before the sessions view.
 */
const searchStatus = (): HTMLElement | undefined =>
  screen
    .getAllByRole('status')
    .filter(
      (region) =>
        within(region).queryByRole('heading') === null && region.closest('header') === null
    )
    .at(-1)

describe('SessionsView search announcements', () => {
  it('has an empty polite status region before anything is typed', async () => {
    showSessions()
    await screen.findByRole('list', { name: DIR })

    expect(searchStatus()?.textContent).toBe('')
  })

  it('announces how many sessions match, and when none do', async () => {
    showSessions()
    await screen.findByRole('list', { name: DIR })
    const search = screen.getByRole('searchbox', { name: 'Search sessions' })

    await userEvent.type(search, 'code')
    await waitFor(() => {
      expect(searchStatus()?.textContent).toBe('2 sessions match')
    })

    await userEvent.clear(search)
    await userEvent.type(search, 'parser')
    await waitFor(() => {
      expect(searchStatus()?.textContent).toBe('1 session matches')
    })

    await userEvent.clear(search)
    await userEvent.type(search, 'zzz')
    await waitFor(() => {
      expect(searchStatus()?.textContent).toBe('No matching sessions')
    })
  })

  it('mounts the count afresh when a new search matches as many sessions as the last', async () => {
    showSessions()
    await screen.findByRole('list', { name: DIR })
    const search = screen.getByRole('searchbox', { name: 'Search sessions' })
    await userEvent.type(search, 'parse')
    await waitFor(() => {
      expect(searchStatus()?.textContent).toBe('1 session matches')
    })
    const before = searchStatus()?.firstElementChild

    await userEvent.type(search, 'r')

    await waitFor(() => {
      expect(searchStatus()?.firstElementChild).not.toBe(before)
    })
    expect(before?.isConnected).toBe(false)
    expect(searchStatus()?.textContent).toBe('1 session matches')
  })
})

/** The status message whose heading has this name. */
const statusWithHeading = (name: string): HTMLElement | undefined =>
  screen
    .getAllByRole('status')
    .find((region) => within(region).queryByRole('heading', { name }) !== null)

describe('SessionsView search announcements while a list loads', () => {
  it('keeps one live region mounted while loading, so a match count is announced when it loads', async () => {
    useSessionsViewStore.setState({ query: 'code' })
    let resolve: (value: IpcResult<readonly SessionListItemDto[]>) => void = () => undefined
    const api = installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () => new Promise((r) => (resolve = r))
    })
    renderApp()
    await screen.findByRole('heading', { name: 'Loading sessions' })
    // The loading message can render before the query's effect makes the call.
    await waitFor(() => {
      expect(api.listSessions).toHaveBeenCalledOnce()
    })
    const region = searchStatus()

    expect(region?.textContent).toBe('')
    await act(async () => {
      resolve({ ok: true, value: SESSIONS })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(region?.textContent).toBe('2 sessions match')
    })
    expect(searchStatus()).toBe(region)
  })

  it('waits for the list that replaces a stale cached one before announcing', async () => {
    useSessionsViewStore.setState({ query: 'code' })
    let resolve: (value: IpcResult<readonly SessionListItemDto[]>) => void = () => undefined
    const api = installBeekeeperApi({ listSessions: () => new Promise((r) => (resolve = r)) })
    const client = createTestQueryClient()
    client.setQueryData(['sessions', DIR], SESSIONS, {
      updatedAt: Date.now() - LISTS_STALE_TIME_MS - 1
    })
    render(<SessionsContent dirName={DIR} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByRole('list', { name: DIR })
    await waitFor(() => {
      expect(api.listSessions).toHaveBeenCalledOnce()
    })

    expect(searchStatus()?.textContent).toBe('')
    await act(async () => {
      resolve({ ok: true, value: [mateA] })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(searchStatus()?.textContent).toBe('1 session matches')
    })
  })

  it('announces nothing for a leftover search in a folder with no sessions', async () => {
    useSessionsViewStore.setState({ query: 'code' })
    installBeekeeperApi({ listSessions: () => ok([]) })
    render(<SessionsContent dirName={DIR} headingId="h" />, { wrapper: createQueryWrapper() })

    await screen.findByRole('heading', { name: 'No sessions in this project' })

    expect(searchStatus()?.textContent).toBe('')
  })
})

describe('SessionsContent with an unreadable folder', () => {
  const unreadable = (): Promise<IpcResult<readonly SessionListItemDto[]>> =>
    Promise.resolve({ ok: false, error: { code: 'unreadable' } })

  it('announces nothing when a background load replaces the error under a leftover search', async () => {
    useSessionsViewStore.setState({ query: 'code' })
    let readable = false
    installBeekeeperApi({ listSessions: () => (readable ? ok(SESSIONS) : unreadable()) })
    const client = createTestQueryClient()
    render(<SessionsContent dirName={DIR} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByRole('alert')

    readable = true
    await refetchAndSettle(client, ['sessions', DIR])

    await screen.findByRole('list', { name: DIR })
    expect(searchStatus()?.textContent).toBe('')
  })

  it('announces the match count once Retry loads the sessions', async () => {
    useSessionsViewStore.setState({ query: 'code' })
    let readable = false
    installBeekeeperApi({ listSessions: () => (readable ? ok(SESSIONS) : unreadable()) })
    render(<SessionsContent dirName={DIR} headingId="h" />, { wrapper: createQueryWrapper() })
    await screen.findByRole('alert')

    readable = true
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(searchStatus()?.textContent).toBe('2 sessions match')
    })
  })

  it('says the folder is unreadable, with Retry', async () => {
    installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    })
    render(<SessionsContent dirName={DIR} headingId="h" />, { wrapper: createQueryWrapper() })

    const alert = await screen.findByRole('alert')

    expect(
      within(alert).getByRole('heading', { name: "Can't read this project's sessions" })
    ).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows the error with Retry while a gone folder resets the selection', async () => {
    installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: false, error: { code: 'not-found' } })
    })
    render(<SessionsContent dirName={DIR} headingId="h" />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('mounts the alert fresh rather than turning the loading message into it', async () => {
    let resolve: (value: IpcResult<readonly SessionListItemDto[]>) => void = () => undefined
    installBeekeeperApi({ listSessions: () => new Promise((r) => (resolve = r)) })
    render(<SessionsContent dirName={DIR} headingId="h" />, { wrapper: createQueryWrapper() })
    await screen.findByRole('heading', { name: 'Loading sessions' })
    const loading = statusWithHeading('Loading sessions')

    await act(async () => {
      resolve({ ok: false, error: { code: 'unreadable' } })
      await Promise.resolve()
    })
    const alert = await screen.findByRole('alert')

    expect(loading).toBeDefined()
    expect(alert).not.toBe(loading)
    expect(loading?.isConnected).toBe(false)
  })
})

describe('SessionsContent with a failed background refresh', () => {
  it('keeps the loaded sessions on screen', async () => {
    let failing = false
    installBeekeeperApi({
      listSessions: () =>
        failing ? Promise.resolve({ ok: false, error: { code: 'internal' } }) : ok(SESSIONS)
    })
    const client = createTestQueryClient()
    render(<SessionsContent dirName={DIR} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByRole('list', { name: DIR })

    failing = true
    await refetchAndSettle(client, ['sessions', DIR])

    expect(client.getQueryState(['sessions', DIR])?.status).toBe('error')
    expect(screen.getByRole('list', { name: DIR })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('SessionsView states', () => {
  it('announces loading', async () => {
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () => new Promise(() => undefined)
    })
    renderApp()

    const heading = await screen.findByRole('heading', { name: 'Loading sessions' })
    expect(heading.closest('[role="status"]')).toBeTruthy()
  })

  it('explains a folder with no sessions', async () => {
    showSessions([])

    expect(await screen.findByRole('heading', { name: 'No sessions in this project' })).toBeTruthy()
  })

  it('shows an error with Retry, and Retry loads the sessions', async () => {
    let calls = 0
    installBeekeeperApi({
      listSessions: () => {
        calls += 1
        // The first call and its three retries fail, so the error state shows.
        return calls <= 4
          ? Promise.resolve({ ok: false, error: { code: 'internal' } })
          : ok(SESSIONS)
      }
    })
    renderApp()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('list', { name: DIR })).toBeTruthy()
  })

  it('moves focus to the main landmark when Retry replaces the error with loading', async () => {
    installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderApp()

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('forgets the selection and refreshes the project list when the folder is gone', async () => {
    useSelectedProjectStore.setState({ selectedDirName: DIR })
    const api = installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: false, error: { code: 'not-found' } })
    })
    renderApp()

    await waitFor(() => {
      expect(useSelectedProjectStore.getState().selectedDirName).toBeNull()
    })
    await waitFor(() => {
      expect(api.listProjects.mock.calls.length).toBeGreaterThan(1)
    })
  })
})
