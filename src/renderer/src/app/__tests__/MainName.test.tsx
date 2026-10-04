import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testDetail } from '@renderer/features/sessionDetail/testSessionDetail'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'

const ref = { projectDirName: '-Users-a-repo', sessionId: 'x' }

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

describe('the main landmark name', () => {
  it('is the project name on the sessions list', async () => {
    renderApp()

    expect(await screen.findByRole('main', { name: '-Users-a-repo' })).toBeTruthy()
  })

  it('becomes the new heading after each navigation', async () => {
    renderApp()
    const sidebar = await screen.findByRole('navigation', { name: 'Projects' })
    await userEvent.click(within(sidebar).getByRole('button', { name: 'All projects' }))
    expect(await screen.findByRole('main', { name: 'All projects' })).toBeTruthy()

    await userEvent.click(within(sidebar).getByRole('button', { name: '-Users-a-repo' }))
    expect(await screen.findByRole('main', { name: '-Users-a-repo' })).toBeTruthy()

    act(() => {
      useNavigationStore.getState().showSession(ref)
    })
    expect(await screen.findByRole('main', { name: 'Untitled session' })).toBeTruthy()
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
