import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  installBeekeeperApi({ listSessions: () => Promise.resolve({ ok: true, value: [] }) })
})

afterEach(resetPersistedState)

describe('SidebarContent', () => {
  it('shows the app name, the project list, and the footer', async () => {
    renderApp()

    const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' })
    await within(sidebar).findByRole('navigation', { name: 'Projects' })

    expect(within(sidebar).getByText('Beekeeper')).toBeTruthy()
    expect(within(sidebar).getByRole('button', { name: 'About Beekeeper' })).toBeTruthy()
    expect(within(sidebar).getByText('Local only · read-only')).toBeTruthy()
  })

  it('shows only the name and footer while there are no projects', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    renderApp()
    await screen.findByRole('heading', { name: 'No sessions found' })

    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' })

    expect(within(sidebar).queryByRole('navigation')).toBeNull()
    expect(within(sidebar).getByText('Beekeeper')).toBeTruthy()
    expect(within(sidebar).getByText('Local only · read-only')).toBeTruthy()
  })
})
