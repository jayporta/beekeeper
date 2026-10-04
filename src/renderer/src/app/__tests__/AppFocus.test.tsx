import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testDetail } from '@renderer/features/sessionDetail/testSessionDetail'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  installBeekeeperApi({
    listSessions: () => Promise.resolve({ ok: true, value: [] }),
    getSession: () => Promise.resolve({ ok: true, value: testDetail() })
  })
})

afterEach(async () => {
  useNavigationStore.setState({ navigationCount: 0 })
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

describe('App focus', () => {
  it('makes the skip link the first stop, ahead of the sidebar', async () => {
    renderApp()
    await screen.findByRole('navigation', { name: 'Projects' })

    await userEvent.tab()

    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to main content' }))
  })

  it('moves focus to main when All projects is chosen', async () => {
    renderApp()
    const sidebar = await screen.findByRole('navigation', { name: 'Projects' })

    await userEvent.click(within(sidebar).getByRole('button', { name: 'All projects' }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('moves focus to main when a project is chosen', async () => {
    renderApp()
    const row = await screen.findByRole('button', { name: '-Users-a-repo' })

    await userEvent.click(row)

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('keeps focus on a live element when the breadcrumb button that had it unmounts', async () => {
    useNavigationStore.getState().showSession({ projectDirName: '-Users-a-repo', sessionId: 'x' })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Sessions' }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('does not take focus on first render', async () => {
    renderApp()
    await screen.findByRole('navigation', { name: 'Projects' })

    expect(document.activeElement).toBe(document.body)
  })
})
