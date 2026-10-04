import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { idbStorage } from '@renderer/storage/idbStorage'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import App from '@renderer/App'
import { SessionsContent } from '../SessionsContent'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import { testSession } from '../testSessionFixtures'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'
const GONE_TEXT = "That project's folder no longer exists."

type SessionsResult = IpcResult<readonly SessionListItemDto[]>
type ProjectsResult = IpcResult<readonly ProjectDto[]>

const alphaSession = testSession(1, { projectDirName: ALPHA, title: 'Alpha work' })
const betaSession = testSession(2, { projectDirName: BETA, title: 'Beta work' })

const notFound = (): Promise<SessionsResult> =>
  Promise.resolve({ ok: false, error: { code: 'not-found' } })
const loaded = (value: readonly SessionListItemDto[]): Promise<SessionsResult> =>
  Promise.resolve({ ok: true, value })
const projects = (...list: ProjectDto[]): Promise<ProjectsResult> =>
  Promise.resolve({ ok: true, value: list })

/** A `listProjects` stub: its first call lists ALPHA and BETA, and every later call answers `refreshed`. */
function listThenRefresh(refreshed: () => Promise<ProjectsResult>): () => Promise<ProjectsResult> {
  let calls = 0
  return () => {
    calls += 1
    return calls === 1 ? projects(testProject(ALPHA), testProject(BETA)) : refreshed()
  }
}

/** The refresh that no longer lists ALPHA. */
const withoutAlpha = (): Promise<ProjectsResult> => projects(testProject(BETA))

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
})

afterEach(resetPersistedState)

/** The announcement text, or `null` when the app has said nothing about a gone folder. */
const goneNotice = (): HTMLElement | null => screen.queryByText(new RegExp(GONE_TEXT))

describe('a selected project whose folder is gone', () => {
  it('announces the project that took over and shows its sessions', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    installBeekeeperApi({
      listProjects: listThenRefresh(withoutAlpha),
      listSessions: (dirName) => (dirName === ALPHA ? notFound() : loaded([betaSession]))
    })

    renderApp()

    expect(await screen.findByText(`${GONE_TEXT} Showing ${BETA}.`)).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 1, name: BETA })).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 2, name: 'Beta work' })).toBeTruthy()
  })

  it('clears the announcement when another project is chosen in the sidebar', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    installBeekeeperApi({
      listProjects: listThenRefresh(withoutAlpha),
      listSessions: (dirName) => (dirName === ALPHA ? notFound() : loaded([betaSession]))
    })
    renderApp()
    await screen.findByText(`${GONE_TEXT} Showing ${BETA}.`)

    await userEvent.click(screen.getByRole('button', { name: BETA }))

    await waitFor(() => {
      expect(goneNotice()).toBeNull()
    })
  })

  it('says only that the folder is gone when it was the only project', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    let projectCalls = 0
    installBeekeeperApi({
      listProjects: () => {
        projectCalls += 1
        return projectCalls === 1 ? projects(testProject(ALPHA)) : projects()
      },
      listSessions: notFound
    })

    renderApp()

    expect(await screen.findByText(GONE_TEXT)).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'No sessions found' })).toBeTruthy()
  })

  it('announces a selection that dropped off the project list before its sessions loaded', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const client = createTestQueryClient()
    installBeekeeperApi({
      listProjects: listThenRefresh(withoutAlpha),
      listSessions: (dirName) =>
        dirName === ALPHA ? new Promise(() => undefined) : loaded([betaSession])
    })
    render(<App />, { wrapper: createQueryWrapper(client) })
    await screen.findByRole('heading', { name: 'Loading sessions' })

    await refetchAndSettle(client, ['projects'])

    expect(await screen.findByText(`${GONE_TEXT} Showing ${BETA}.`)).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 2, name: 'Beta work' })).toBeTruthy()
  })

  it('announces once, naming the project that took over, when the stored folder was deleted while the app was closed', async () => {
    await idbStorage.setItem(
      'selected-project',
      JSON.stringify({ state: { selectedDirName: '-Users-a-deleted' }, version: 0 })
    )
    installBeekeeperApi({
      listProjects: () => projects(testProject(ALPHA), testProject(BETA)),
      listSessions: () => loaded([alphaSession])
    })

    renderApp()

    expect(await screen.findByText(`${GONE_TEXT} Showing ${ALPHA}.`)).toBeTruthy()
    expect(screen.getAllByText(new RegExp(GONE_TEXT))).toHaveLength(1)
    await waitFor(async () => {
      const stored = await idbStorage.getItem('selected-project')
      expect(JSON.parse(stored ?? '{}')).toMatchObject({ state: { selectedDirName: null } })
    })
  })
})

describe('a gone folder that the refreshed project list still names first', () => {
  it('ends on the error with Retry and says nothing about a gone folder', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const api = installBeekeeperApi({
      listProjects: () => projects(testProject(ALPHA), testProject(BETA)),
      listSessions: notFound
    })

    renderApp()

    const alert = await screen.findByRole('alert')
    await waitFor(() => {
      expect(api.listProjects.mock.calls.length).toBeGreaterThan(1)
    })
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(goneNotice()).toBeNull()
  })

  it('ends on the error with Retry when the project list fails to refresh', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const api = installBeekeeperApi({
      listProjects: listThenRefresh(() =>
        Promise.resolve({ ok: false, error: { code: 'unreadable' } })
      ),
      listSessions: notFound
    })

    renderApp()

    const alert = await screen.findByRole('alert')
    await waitFor(() => {
      expect(api.listProjects.mock.calls.length).toBeGreaterThan(1)
    })
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(goneNotice()).toBeNull()
  })

  it('refreshes the project list again when Retry finds the folder gone again', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const api = installBeekeeperApi({
      listProjects: () => projects(testProject(ALPHA), testProject(BETA)),
      listSessions: notFound
    })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(api.listProjects.mock.calls.length).toBeGreaterThan(1)
    })
    const callsBefore = api.listProjects.mock.calls.length

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(api.listProjects.mock.calls.length).toBeGreaterThan(callsBefore)
    })
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})

describe('a list that was loaded before its folder went missing', () => {
  const staleUpdatedAt = Date.now() - LISTS_STALE_TIME_MS - 1

  it('shows the error with Retry instead of the earlier list when a refetch finds the folder gone', async () => {
    let gone = false
    installBeekeeperApi({ listSessions: () => (gone ? notFound() : loaded([alphaSession])) })
    const client = createTestQueryClient()
    render(<SessionsContent dirName={ALPHA} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByText('Alpha work')

    gone = true
    await refetchAndSettle(client, ['sessions', ALPHA])

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText('Alpha work')).toBeNull()
  })

  it('does the same for a list restored from the persisted cache', async () => {
    installBeekeeperApi({ listSessions: notFound })
    const client = createTestQueryClient()
    client.setQueryData(['sessions', ALPHA], [alphaSession], { updatedAt: staleUpdatedAt })

    render(<SessionsContent dirName={ALPHA} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText('Alpha work')).toBeNull()
  })

  it('forgets the folder again on each later refetch that finds it gone', async () => {
    installBeekeeperApi({ listSessions: notFound })
    const client = createTestQueryClient()
    client.setQueryData(['sessions', ALPHA], [alphaSession], { updatedAt: staleUpdatedAt })
    render(<SessionsContent dirName={ALPHA} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    await waitFor(() => {
      expect(useSelectedProjectStore.getState().goneDirName).toBe(ALPHA)
    })
    useSelectedProjectStore.getState().clearGoneFolder()

    await refetchAndSettle(client, ['sessions', ALPHA])

    await waitFor(() => {
      expect(useSelectedProjectStore.getState().goneDirName).toBe(ALPHA)
    })
  })
})
