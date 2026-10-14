import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testSession } from '@renderer/features/sessions/testSessionFixtures'
import { hydratePersistedStores, renderAppReady } from '@renderer/testAppReady'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { resetPersistedState } from '@renderer/testRenderApp'

let api: ReturnType<typeof installBeekeeperApi>

beforeEach(async () => {
  useFirstRunStore.setState({ dismissed: true })
  await hydratePersistedStores()
  api = installBeekeeperApi({ listSessions: () => Promise.resolve({ ok: true, value: [] }) })
})

afterEach(async () => {
  await resetPersistedState()
})

const backButton = (): HTMLElement => screen.getByRole('button', { name: 'Back' })
const sessionsHeading = (): HTMLElement =>
  screen.getByRole('heading', { level: 1, name: '-Users-a-repo' })

/** Renders the app on the sessions list, then moves to the overview, so there is a place to go back to. */
async function renderAwayFromSessions(): Promise<void> {
  await renderAppReady()
  act(() => {
    useNavigationStore.getState().showOverview()
  })
  screen.getByRole('heading', { level: 1, name: 'All projects' })
}

describe('MainView Back button', () => {
  it('is on the page but unavailable before the person has navigated', async () => {
    await renderAppReady()

    expect(backButton().getAttribute('aria-disabled')).toBe('true')
  })

  it('becomes available once the person navigates', async () => {
    await renderAwayFromSessions()

    expect(backButton().getAttribute('aria-disabled')).toBe('false')
  })

  it('returns to the previous view when pressed', async () => {
    await renderAwayFromSessions()

    await userEvent.click(backButton())

    expect(sessionsHeading()).toBeTruthy()
    expect(backButton().getAttribute('aria-disabled')).toBe('true')
  })

  it('moves focus to the main area, like any navigation', async () => {
    await renderAwayFromSessions()

    await userEvent.click(backButton())

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('sits above the view, outside the breadcrumb', async () => {
    await renderAppReady()

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })

    expect(breadcrumb.contains(backButton())).toBe(false)
    expect(
      backButton().compareDocumentPosition(sessionsHeading()) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('is not on the first-run screen', async () => {
    useFirstRunStore.setState({ dismissed: false })
    await renderAppReady()

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('is not shown when there are no projects to show', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    await renderAppReady()

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })
})

describe('MainView Back shortcuts', () => {
  it('goes back when the View menu asks', async () => {
    await renderAwayFromSessions()

    act(() => {
      api.fireGoBack()
    })

    expect(sessionsHeading()).toBeTruthy()
  })

  it('goes back on Alt and the left arrow', async () => {
    await renderAwayFromSessions()

    fireEvent.keyDown(screen.getByRole('main'), { key: 'ArrowLeft', altKey: true })

    expect(sessionsHeading()).toBeTruthy()
  })

  it('does not go back on Alt and the left arrow typed in the search box', async () => {
    installBeekeeperApi({
      listSessions: () =>
        Promise.resolve({ ok: true, value: [testSession(1, { projectDirName: '-Users-a-repo' })] })
    })
    await renderAppReady()
    act(() => {
      useNavigationStore.getState().showOverview()
    })
    act(() => {
      useNavigationStore.getState().showSessions()
    })
    const search = await screen.findByRole('searchbox')
    const before = useNavigationStore.getState()

    fireEvent.keyDown(search, { key: 'ArrowLeft', altKey: true })

    expect(useNavigationStore.getState().history).toEqual(before.history)
    expect(useNavigationStore.getState().navigationCount).toBe(before.navigationCount)
  })

  it('goes back on the mouse back button', async () => {
    await renderAwayFromSessions()

    fireEvent.mouseUp(screen.getByRole('main'), { button: 3 })

    expect(sessionsHeading()).toBeTruthy()
  })

  it('does nothing on a shortcut when there is nowhere to go back to', async () => {
    await renderAppReady()
    const before = useNavigationStore.getState()

    act(() => {
      api.fireGoBack()
    })
    fireEvent.keyDown(screen.getByRole('main'), { key: 'ArrowLeft', altKey: true })
    fireEvent.mouseUp(screen.getByRole('main'), { button: 3 })

    expect(useNavigationStore.getState()).toBe(before)
  })
})
