import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FIRST_RUN_STORAGE_KEY,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { idbStorage } from '@renderer/storage/idbStorage'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'

beforeEach(() => {
  installBeekeeperApi({
    listProjects: () =>
      Promise.resolve({
        ok: true,
        value: [testProject(ALPHA), testProject(BETA)]
      }),
    listSessions: () => Promise.resolve({ ok: true, value: [] }),
    getProjectTotals: () => new Promise(() => undefined)
  })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

const welcome = (): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 1, name: 'Welcome to beekeeper' })

async function renderWithFirstRun(): Promise<HTMLElement> {
  renderApp()
  await welcome()
  return screen.findByRole('navigation', { name: 'Projects' })
}

describe('the sidebar while the first-run screen shows', () => {
  it('dismisses the screen and shows the project when a project row is pressed', async () => {
    const nav = await renderWithFirstRun()

    await userEvent.click(within(nav).getByRole('button', { name: BETA }))

    expect(screen.queryByRole('heading', { name: 'Welcome to beekeeper' })).toBeNull()
    expect(await screen.findByRole('heading', { level: 1, name: BETA })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: BETA }).getAttribute('aria-current')).toBe(
      'page'
    )
  })

  it('persists the dismissal when a project row is pressed', async () => {
    const nav = await renderWithFirstRun()

    await userEvent.click(within(nav).getByRole('button', { name: BETA }))

    await vi.waitFor(async () => {
      expect(await idbStorage.getItem(FIRST_RUN_STORAGE_KEY)).toContain('"dismissed":true')
    })
  })

  it('dismisses the screen and shows the overview when All projects is pressed', async () => {
    const nav = await renderWithFirstRun()

    await userEvent.click(within(nav).getByRole('button', { name: 'All projects' }))

    expect(screen.queryByRole('heading', { name: 'Welcome to beekeeper' })).toBeNull()
    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
    expect(
      within(nav).getByRole('button', { name: 'All projects' }).getAttribute('aria-current')
    ).toBe('page')
    expect(useFirstRunStore.getState().dismissed).toBe(true)
  })

  it.each([
    ['a project row', BETA],
    ['All projects', 'All projects']
  ])('leaves focus on the main landmark after %s is pressed', async (_label, name) => {
    const nav = await renderWithFirstRun()

    await userEvent.click(within(nav).getByRole('button', { name }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })
})
