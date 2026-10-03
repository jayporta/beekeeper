import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { idbStorage } from '@renderer/storage/idbStorage'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPersistedState()
})

const seed = (value: string): Promise<void> => idbStorage.setItem('selected-project', value)

const storedSelection = (selectedDirName: unknown, extra: object = {}): string =>
  JSON.stringify({ state: { selectedDirName, ...extra }, version: 0 })

async function renderLoaded(): Promise<HTMLElement> {
  installBeekeeperApi({
    listProjects: () =>
      Promise.resolve({ ok: true, value: [testProject(ALPHA), testProject(BETA)] }),
    listSessions: () => Promise.resolve({ ok: true, value: [] })
  })
  renderApp()
  return screen.findByRole('navigation', { name: 'Projects' })
}

/** Whether the row with this accessible name is the current page. */
const isCurrent = (nav: HTMLElement, name: string): boolean =>
  within(nav).queryByRole('button', { name, current: 'page' }) !== null

describe('ProjectList with a stored selection', () => {
  it('restores the stored selection when it is still listed', async () => {
    await seed(storedSelection(BETA))

    expect(isCurrent(await renderLoaded(), BETA)).toBe(true)
  })

  it('falls back to the first parent project when the stored one is no longer listed', async () => {
    await seed(storedSelection('-Users-gone'))

    const nav = await renderLoaded()

    expect(isCurrent(nav, ALPHA)).toBe(true)
    expect(screen.getByText(ALPHA, { selector: 'p' })).toBeTruthy()
  })

  it('still renders, and logs one fixed message, for a stored value that is not JSON', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await seed('not json {secret transcript text')

    const nav = await renderLoaded()

    expect(isCurrent(nav, ALPHA)).toBe(true)
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not restore "selected-project" from IndexedDB.'
    )
  })

  it.each([
    ['a number', 42],
    ['an object', { name: BETA }]
  ])('ignores a stored selectedDirName that is %s', async (_label, selectedDirName) => {
    await seed(storedSelection(selectedDirName))

    await renderLoaded()

    expect(useSelectedProjectStore.getState().selectedDirName).toBeNull()
  })

  it('keeps the store actions when the stored value has keys of the same name', async () => {
    await seed(storedSelection(ALPHA, { select: 'x', resetSelection: 'y' }))
    const nav = await renderLoaded()

    await userEvent.click(within(nav).getByRole('button', { name: BETA }))

    expect(useSelectedProjectStore.getState().selectedDirName).toBe(BETA)
    expect(typeof useSelectedProjectStore.getState().resetSelection).toBe('function')
  })
})
