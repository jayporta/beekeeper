import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testDetail } from '@renderer/features/sessionDetail/testSessionDetail'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'

const ref = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  installBeekeeperApi({
    listSessions: () => Promise.resolve({ ok: true, value: [] }),
    getSession: () => Promise.resolve({ ok: true, value: testDetail() })
  })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

describe('MainView', () => {
  it('shows the sessions list by default', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
  })

  it('shows the overview placeholder on the overview view', async () => {
    useNavigationStore.getState().showOverview()
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '-Users-a-repo' })).toBeNull()
  })

  it('shows the session detail with a breadcrumb on the session view', async () => {
    useNavigationStore.getState().showSession(ref)
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Session' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy()
  })

  it('returns to the sessions list from the session breadcrumb', async () => {
    useNavigationStore.getState().showSession(ref)
    renderApp()

    await userEvent.click(await screen.findByRole('button', { name: 'Sessions' }))

    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('keeps the first-run screen ahead of every view', async () => {
    useFirstRunStore.setState({ dismissed: false })
    useNavigationStore.getState().showOverview()
    renderApp()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to Beekeeper' })
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'All projects' })).toBeNull()
  })

  it('keeps the projects gate around the overview', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    useNavigationStore.getState().showOverview()
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'No sessions found' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'All projects' })).toBeNull()
  })

  it('moves from one view to another when the store changes', async () => {
    renderApp()
    await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })

    act(() => {
      useNavigationStore.getState().showOverview()
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
  })

  it('returns to the sessions list when another project is selected', async () => {
    installBeekeeperApi({
      listProjects: () =>
        Promise.resolve({
          ok: true,
          value: [testProject('-Users-a-one'), testProject('-Users-a-two')]
        }),
      listSessions: () => Promise.resolve({ ok: true, value: [] }),
      getSession: () => Promise.resolve({ ok: true, value: testDetail() })
    })
    useNavigationStore.getState().showSession(ref)
    renderApp()
    await screen.findByRole('heading', { level: 1, name: 'Session' })

    act(() => {
      useSelectedProjectStore.getState().select('-Users-a-two')
    })

    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-two' })).toBeTruthy()
  })

  it('keeps the same gone-folder status in the page while the first-run screen closes', async () => {
    useFirstRunStore.setState({ dismissed: false })
    renderApp()
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Beekeeper' })
    const statusRegion = (): HTMLElement | undefined =>
      within(screen.getByRole('main')).queryAllByRole('status')[0]
    const before = statusRegion()

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })

    expect(before).toBeDefined()
    expect(statusRegion()).toBe(before)
  })
})
