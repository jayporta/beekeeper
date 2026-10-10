import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { BeekeeperApi } from '../../../../../shared/ipc/beekeeperApi'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi, testProject, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import { testSession } from '../testSessionFixtures'

const DIR = '-Users-a-repo'

const session = (n: number, title: string, latestMs: number): SessionListItemDto =>
  testSession(n, { projectDirName: DIR, title, latestMs })

let current: readonly SessionListItemDto[]
let api: TestBeekeeperApi
let listSessions: Mock<BeekeeperApi['listSessions']>

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
  current = [session(1, 'Alpha', 200), session(2, 'Beta', 100)]
  listSessions = vi.fn<BeekeeperApi['listSessions']>(() =>
    Promise.resolve({ ok: true, value: current })
  )
  api = installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
    listSessions
  })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

const titles = (): (string | null)[] =>
  within(screen.getByRole('list', { name: DIR }))
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)

/** The live region showing `text`, which stays mounted while each announcement replaces its text. */
const findStatusSaying = async (text: string): Promise<Element | null> =>
  (await screen.findByText(text)).closest('[role="status"]')

/** Delivers a change in the folder and waits for the list to be fetched again. */
async function refetchAfterChange(calls: number): Promise<void> {
  act(() => {
    api.fireFilesChanged({ dirNames: [DIR], foldersChanged: false, all: false })
  })
  await waitFor(() => {
    expect(listSessions).toHaveBeenCalledTimes(calls)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('session cards while the list refreshes in the background', () => {
  it('keeps the visible order when a lower session becomes the newest', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 2, name: 'Alpha' })

    current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]
    await refetchAfterChange(2)

    expect(titles()).toEqual(['Alpha', 'Beta'])
  })

  it('shows a new session first', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 2, name: 'Alpha' })

    current = [session(3, 'Gamma', 50), session(1, 'Alpha', 200), session(2, 'Beta', 100)]
    await refetchAfterChange(2)

    expect(titles()).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  it('sorts again when Refresh is pressed', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { level: 2, name: 'Alpha' })
    current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]
    await refetchAfterChange(2)
    expect(titles()).toEqual(['Alpha', 'Beta'])

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(titles()).toEqual(['Beta', 'Alpha'])
    })
  })

  it('sorts the data a Refresh press fetches, not the data already shown', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { level: 2, name: 'Alpha' })
    // No change event arrives, as when live updates are paused: only the press fetches.
    current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(titles()).toEqual(['Beta', 'Alpha'])
    })
  })

  it('keeps the order for a later live update after a Refresh that failed', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { level: 2, name: 'Alpha' })
    listSessions.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    )
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect((await screen.findAllByText("Couldn't refresh the lists.")).length).toBeGreaterThan(0)

    current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]
    await refetchAfterChange(3)

    expect(titles()).toEqual(['Alpha', 'Beta'])
  })

  it('keeps each card’s element in the same place across a reordering refresh', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 2, name: 'Alpha' })
    const cards = (): Element[] => [...screen.getByRole('list', { name: DIR }).children]
    const before = cards()

    current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]
    await refetchAfterChange(2)

    const after = cards()
    expect(after).toHaveLength(2)
    after.forEach((card, index) => {
      expect(card).toBe(before[index])
    })
  })

  describe('a list old enough to be refetched as it opens', () => {
    it('re-sorts a list that was invalidated while hidden when its view opens', async () => {
      const client = createTestQueryClient()
      client.setQueryData(['sessions', DIR], [session(1, 'Alpha', 200), session(2, 'Beta', 100)])
      await client.invalidateQueries({ queryKey: ['sessions', DIR] })
      current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]
      renderApp(client)

      await waitFor(() => {
        expect(titles()).toEqual(['Beta', 'Alpha'])
      })
    })

    const staleUpdatedAt = (): number => Date.now() - LISTS_STALE_TIME_MS - 1

    it('shows the fetched order once it arrives, instead of keeping the saved one', async () => {
      const client = createTestQueryClient()
      client.setQueryData(['sessions', DIR], [session(1, 'Alpha', 200), session(2, 'Beta', 100)], {
        updatedAt: staleUpdatedAt()
      })
      current = [session(1, 'Alpha', 200), session(2, 'Beta', 300)]
      renderApp(client)

      await waitFor(() => {
        expect(titles()).toEqual(['Beta', 'Alpha'])
      })
    })

    it('does the same for the next folder a person opens', async () => {
      const OTHER = '-Users-a-other'
      const other = (n: number, title: string, latestMs: number): SessionListItemDto =>
        testSession(n, { projectDirName: OTHER, title, latestMs })
      const client = createTestQueryClient()
      client.setQueryData(['sessions', OTHER], [other(3, 'Gamma', 200), other(4, 'Delta', 100)], {
        updatedAt: staleUpdatedAt()
      })
      installBeekeeperApi({
        listProjects: () =>
          Promise.resolve({ ok: true, value: [testProject(DIR), testProject(OTHER)] }),
        listSessions: (dirName) =>
          Promise.resolve({
            ok: true,
            value: dirName === DIR ? current : [other(3, 'Gamma', 200), other(4, 'Delta', 300)]
          })
      })
      renderApp(client)
      await screen.findByRole('heading', { level: 2, name: 'Alpha' })

      act(() => {
        useSelectedProjectStore.getState().select(OTHER)
      })

      await waitFor(() => {
        expect(
          within(screen.getByRole('list', { name: OTHER }))
            .getAllByRole('heading', { level: 2 })
            .map((heading) => heading.textContent)
        ).toEqual(['Delta', 'Gamma'])
      })
    })

    it('does the same for a folder whose last load failed after its list was saved', async () => {
      const OTHER = '-Users-a-other'
      const other = (n: number, title: string, latestMs: number): SessionListItemDto =>
        testSession(n, { projectDirName: OTHER, title, latestMs })
      const client = createTestQueryClient()
      const savedAt = staleUpdatedAt()
      client.setQueryData(['sessions', OTHER], [other(3, 'Gamma', 200), other(4, 'Delta', 100)], {
        updatedAt: savedAt
      })
      client
        .getQueryCache()
        .find({ queryKey: ['sessions', OTHER] })
        ?.setState({ status: 'error', error: new Error('failed'), errorUpdatedAt: savedAt + 1000 })
      installBeekeeperApi({
        listProjects: () =>
          Promise.resolve({ ok: true, value: [testProject(DIR), testProject(OTHER)] }),
        listSessions: (dirName) =>
          Promise.resolve({
            ok: true,
            value: dirName === DIR ? current : [other(3, 'Gamma', 200), other(4, 'Delta', 300)]
          })
      })
      renderApp(client)
      await screen.findByRole('heading', { level: 2, name: 'Alpha' })

      act(() => {
        useSelectedProjectStore.getState().select(OTHER)
      })

      await waitFor(() => {
        expect(
          within(screen.getByRole('list', { name: OTHER }))
            .getAllByRole('heading', { level: 2 })
            .map((heading) => heading.textContent)
        ).toEqual(['Delta', 'Gamma'])
      })
    })

    it('does the same for a folder opened after a Refresh in another one', async () => {
      const user = userEvent.setup()
      const OTHER = '-Users-a-other'
      const other = (n: number, title: string, latestMs: number): SessionListItemDto =>
        testSession(n, { projectDirName: OTHER, title, latestMs })
      const client = createTestQueryClient()
      // Saved long before the Refresh below, so its opening request is earlier than that one.
      client.setQueryData(['sessions', OTHER], [other(3, 'Gamma', 200), other(4, 'Delta', 100)], {
        updatedAt: staleUpdatedAt()
      })
      installBeekeeperApi({
        listProjects: () =>
          Promise.resolve({ ok: true, value: [testProject(DIR), testProject(OTHER)] }),
        listSessions: (dirName) =>
          Promise.resolve({
            ok: true,
            value: dirName === DIR ? current : [other(3, 'Gamma', 200), other(4, 'Delta', 300)]
          })
      })
      renderApp(client)
      await screen.findByRole('heading', { level: 2, name: 'Alpha' })
      await user.click(screen.getByRole('button', { name: 'Refresh' }))
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Refresh' }).getAttribute('aria-disabled')
        ).not.toBe('true')
      })

      act(() => {
        useSelectedProjectStore.getState().select(OTHER)
      })

      await waitFor(() => {
        expect(
          within(screen.getByRole('list', { name: OTHER }))
            .getAllByRole('heading', { level: 2 })
            .map((heading) => heading.textContent)
        ).toEqual(['Delta', 'Gamma'])
      })
    })
  })
})

describe('the search announcement while the list refreshes in the background', () => {
  it('keeps the announced match count when a background update adds a match', async () => {
    useSessionsViewStore.setState({ query: 'a' })
    renderApp()
    await screen.findByText('2 sessions match')

    current = [session(3, 'Gamma', 300), session(1, 'Alpha', 200), session(2, 'Beta', 100)]
    await refetchAfterChange(2)

    expect(titles()).toEqual(['Gamma', 'Alpha', 'Beta'])
    expect(screen.getByText('2 sessions match')).toBeTruthy()
  })

  it('announces nothing when an empty folder gains a match for a leftover search', async () => {
    useSessionsViewStore.setState({ query: 'a' })
    current = []
    renderApp()
    await screen.findByRole('heading', { name: 'No sessions in this project' })

    current = [session(1, 'Alpha', 200)]
    await refetchAfterChange(2)

    expect(titles()).toEqual(['Alpha'])
    expect(screen.queryByText('1 session matches')).toBeNull()
  })

  it('announces nothing when a list that emptied gains matches again', async () => {
    useSessionsViewStore.setState({ query: 'a' })
    renderApp()
    await screen.findByText('2 sessions match')

    current = []
    await refetchAfterChange(2)
    await screen.findByRole('heading', { name: 'No sessions in this project' })
    current = [session(1, 'Alpha', 200)]
    await refetchAfterChange(3)

    expect(titles()).toEqual(['Alpha'])
    expect(screen.queryByText('1 session matches')).toBeNull()
  })
})

describe('the search announcement after a Refresh', () => {
  it('announces the match count of the list a Refresh press fetched', async () => {
    const user = userEvent.setup()
    useSessionsViewStore.setState({ query: 'a' })
    renderApp()
    const region = await findStatusSaying('2 sessions match')
    current = [session(3, 'Gamma', 300), session(1, 'Alpha', 200), session(2, 'Beta', 100)]

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(region?.textContent).toBe('3 sessions match')
    })
  })
})

describe('the search announcement across a folder switch', () => {
  it('says the new folder’s match count in the region that was already on the page', async () => {
    const OTHER = '-Users-a-other'
    useSessionsViewStore.setState({ query: 'a' })
    const client = createTestQueryClient()
    client.setQueryData(
      ['sessions', OTHER],
      [testSession(3, { projectDirName: OTHER, title: 'Gamma' })]
    )
    installBeekeeperApi({
      listProjects: () =>
        Promise.resolve({ ok: true, value: [testProject(DIR), testProject(OTHER)] }),
      listSessions: (dirName) =>
        Promise.resolve({
          ok: true,
          value:
            dirName === DIR ? current : [testSession(3, { projectDirName: OTHER, title: 'Gamma' })]
        })
    })
    renderApp(client)
    const region = await findStatusSaying('2 sessions match')

    act(() => {
      useSelectedProjectStore.getState().select(OTHER)
    })

    await waitFor(() => {
      expect(region?.textContent).toBe('1 session matches')
    })
  })
})
