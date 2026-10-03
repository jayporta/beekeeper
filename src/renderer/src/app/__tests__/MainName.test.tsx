import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'

const ref = { projectDirName: '-Users-a-repo', sessionId: 'x' }

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  installBeekeeperApi({ listSessions: () => Promise.resolve({ ok: true, value: [] }) })
})

afterEach(async () => {
  useNavigationStore.setState({ navigationCount: 0 })
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

describe('the main landmark name', () => {
  it('is the sessions heading on the sessions list', async () => {
    renderApp()

    expect(await screen.findByRole('main', { name: 'Sessions' })).toBeTruthy()
  })

  it('becomes the new heading after each navigation', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'All projects' }))
    expect(await screen.findByRole('main', { name: 'All projects' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: '-Users-a-repo' }))
    expect(await screen.findByRole('main', { name: 'Sessions' })).toBeTruthy()

    act(() => {
      useNavigationStore.getState().showSession(ref)
    })
    expect(await screen.findByRole('main', { name: 'Session' })).toBeTruthy()
  })

  it('is the first-run heading on the first-run screen', async () => {
    useFirstRunStore.setState({ dismissed: false })
    renderApp()

    expect(await screen.findByRole('main', { name: 'Welcome to Beekeeper' })).toBeTruthy()
  })

  it('is the status heading when the projects gate has a message to show', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    renderApp()

    expect(await screen.findByRole('main', { name: 'No sessions found' })).toBeTruthy()
  })
})
