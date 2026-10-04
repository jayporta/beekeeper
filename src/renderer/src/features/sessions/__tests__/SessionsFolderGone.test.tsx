import { act, render, screen, waitFor, within } from '@testing-library/react'
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
const GAMMA = '-Users-a-gamma'
const DELETED = '-Users-a-deleted'

/** The sentence that names a folder that no longer exists. */
const folderGone = (folder: string): string => `The folder ${folder} no longer exists.`

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

/** A `listProjects` stub: its first call lists `first`, and every later call answers `refreshed`. */
function listThenRefresh(
  refreshed: () => Promise<ProjectsResult>,
  first: readonly ProjectDto[] = [testProject(ALPHA), testProject(BETA)]
): () => Promise<ProjectsResult> {
  let calls = 0
  return () => {
    calls += 1
    return calls === 1 ? projects(...first) : refreshed()
  }
}

/** The refresh that no longer lists ALPHA. */
const withoutAlpha = (): Promise<ProjectsResult> => projects(testProject(BETA))

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
})

afterEach(resetPersistedState)

/** Waits so a change that would follow can happen, before an assertion that nothing did. */
async function settleFor(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

/** The announcement text, or `null` when the app has said nothing about a gone folder. */
const goneNotice = (): HTMLElement | null => screen.queryByText(/^The folder .* no longer exists\./)

describe('a selected project whose folder is gone', () => {
  it('announces the project that took over and shows its sessions', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    installBeekeeperApi({
      listProjects: listThenRefresh(withoutAlpha),
      listSessions: (dirName) => (dirName === ALPHA ? notFound() : loaded([betaSession]))
    })

    renderApp()

    expect(await screen.findByText(`${folderGone(ALPHA)} Showing ${BETA}.`)).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 1, name: BETA })).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 2, name: 'Beta work' })).toBeTruthy()
  })

  it('clears the announcement when a different project is chosen in the sidebar', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    installBeekeeperApi({
      listProjects: listThenRefresh(
        () => projects(testProject(BETA), testProject(GAMMA)),
        [testProject(ALPHA), testProject(BETA), testProject(GAMMA)]
      ),
      listSessions: (dirName) => (dirName === ALPHA ? notFound() : loaded([betaSession]))
    })
    renderApp()
    await screen.findByText(`${folderGone(ALPHA)} Showing ${BETA}.`)

    await userEvent.click(screen.getByRole('button', { name: GAMMA }))

    expect(await screen.findByRole('heading', { level: 1, name: GAMMA })).toBeTruthy()
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

    expect(await screen.findByText(folderGone(ALPHA))).toBeTruthy()
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

    expect(await screen.findByText(`${folderGone(ALPHA)} Showing ${BETA}.`)).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 2, name: 'Beta work' })).toBeTruthy()
  })

  it('announces a folder deleted while the app was closed, then forgets it so the next start is silent', async () => {
    await idbStorage.setItem(
      'selected-project',
      JSON.stringify({ state: { selectedDirName: DELETED }, version: 0 })
    )
    installBeekeeperApi({
      listProjects: () => projects(testProject(ALPHA), testProject(BETA)),
      listSessions: () => loaded([alphaSession])
    })

    renderApp()

    expect(await screen.findByText(`${folderGone(DELETED)} Showing ${ALPHA}.`)).toBeTruthy()
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

  it('says the project folder was not found, in its own alert with Retry', async () => {
    installBeekeeperApi({ listSessions: notFound })

    render(<SessionsContent dirName={ALPHA} headingId="h" />, { wrapper: createQueryWrapper() })

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Project folder not found' })).toBeTruthy()
    expect(
      within(alert).getByText("This project's folder no longer exists in ~/.claude/projects.")
    ).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('mounts a fresh alert when Retry finds the folder gone again while a list is still cached', async () => {
    const api = installBeekeeperApi({ listSessions: notFound })
    const client = createTestQueryClient()
    client.setQueryData(['sessions', ALPHA], [alphaSession], { updatedAt: staleUpdatedAt })
    render(<SessionsContent dirName={ALPHA} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    const first = await screen.findByRole('alert')

    await userEvent.click(within(first).getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(api.listSessions).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('alert')).not.toBe(first)
    })
    expect(first.isConnected).toBe(false)
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

describe('a gone folder that comes back', () => {
  /**
   * Shows ALPHA's "folder not found" error, with the refreshed project list still
   * naming it, then lets its sessions load on the next try. Returns what a test
   * needs to retry and to reorder the project list.
   */
  async function renderGoneThenBack(): Promise<{
    client: ReturnType<typeof createTestQueryClient>
    retry: () => Promise<void>
    listBetaFirst: () => void
  }> {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const client = createTestQueryClient()
    let back = false
    let listed = [testProject(ALPHA), testProject(BETA)]
    installBeekeeperApi({
      listProjects: () => projects(...listed),
      listSessions: (dirName) =>
        dirName === ALPHA && !back ? notFound() : loaded([alphaSession, betaSession])
    })
    render(<App />, { wrapper: createQueryWrapper(client) })
    await screen.findByRole('button', { name: 'Retry' })
    return {
      client,
      retry: async () => {
        back = true
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
      },
      listBetaFirst: () => {
        listed = [testProject(BETA), testProject(ALPHA)]
      }
    }
  }

  it('selects the folder again and drops the record once Retry loads its sessions', async () => {
    const { retry } = await renderGoneThenBack()

    await retry()

    await waitFor(() => {
      expect(useSelectedProjectStore.getState()).toMatchObject({
        selectedDirName: ALPHA,
        goneDirName: null
      })
    })
  })

  it('does not say the folder is gone when a later list puts another project first', async () => {
    const { client, retry, listBetaFirst } = await renderGoneThenBack()
    await retry()
    await screen.findByRole('heading', { level: 2, name: 'Alpha work' })

    listBetaFirst()
    await refetchAndSettle(client, ['projects'])

    expect(goneNotice()).toBeNull()
    expect(await screen.findByRole('heading', { level: 1, name: ALPHA })).toBeTruthy()
  })
})

describe('a folder that went missing and later came back', () => {
  it('can be chosen again from the sidebar without a false notice, while its old error is still cached', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const client = createTestQueryClient()
    let alphaGone = false
    let listed = [testProject(ALPHA), testProject(BETA)]
    installBeekeeperApi({
      listProjects: () => projects(...listed),
      listSessions: (dirName) =>
        dirName === ALPHA && alphaGone ? notFound() : loaded([alphaSession, betaSession])
    })
    render(<App />, { wrapper: createQueryWrapper(client) })
    await screen.findByRole('heading', { level: 2, name: 'Alpha work' })
    alphaGone = true
    listed = [testProject(BETA)]
    await refetchAndSettle(client, ['sessions', ALPHA])
    await screen.findByText(`${folderGone(ALPHA)} Showing ${BETA}.`)
    alphaGone = false
    listed = [testProject(BETA), testProject(ALPHA)]
    await refetchAndSettle(client, ['projects'])

    await userEvent.click(await screen.findByRole('button', { name: ALPHA }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Alpha work' })).toBeTruthy()
    await settleFor(50)
    expect(screen.getByRole('button', { name: ALPHA }).getAttribute('aria-current')).toBe('page')
    expect(goneNotice()).toBeNull()
  })
})
