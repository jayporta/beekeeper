import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { idbStorage } from '@renderer/storage/idbStorage'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useFirstRunStore } from '../../firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

afterEach(async () => {
  vi.restoreAllMocks()
  await resetPersistedState()
})

const PROJECTS = [
  testProject('-Users-a-alpha'),
  testProject('-Users-a-alpha--claude-worktrees-x', '-Users-a-alpha'),
  testProject('-Users-a-beta')
]

async function renderLoaded(): Promise<HTMLSelectElement> {
  installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: PROJECTS }) })
  useFirstRunStore.setState({ dismissed: true })
  renderApp()
  return (await screen.findByRole('combobox', { name: 'Project' })) as HTMLSelectElement
}

describe('ProjectPicker', () => {
  it('lists parent projects as options and worktree folders in a group under their parent', async () => {
    const select = await renderLoaded()

    const group = within(select).getByRole('group', { name: '-Users-a-alpha worktrees' })
    expect(
      within(group).getByRole('option', { name: '-Users-a-alpha--claude-worktrees-x' })
    ).toBeTruthy()
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['-Users-a-alpha', '-Users-a-alpha--claude-worktrees-x', '-Users-a-beta'])
  })

  it('has no group for a project with no worktree folders', async () => {
    const select = await renderLoaded()

    expect(within(select).getAllByRole('group')).toHaveLength(1)
  })

  it('selects the first parent project when nothing is stored', async () => {
    const select = await renderLoaded()

    expect(select.value).toBe('-Users-a-alpha')
  })

  it('shows the note about worktree folders', async () => {
    await renderLoaded()

    expect(screen.getByText('Worktree folders are grouped under their project.')).toBeTruthy()
  })

  it('updates the store and the heading subtitle when another project is chosen', async () => {
    const select = await renderLoaded()

    await userEvent.selectOptions(select, '-Users-a-beta')

    expect(useSelectedProjectStore.getState().selectedDirName).toBe('-Users-a-beta')
    expect(screen.getByText('-Users-a-beta', { selector: 'p' })).toBeTruthy()
  })

  it('restores the stored selection when it is still listed', async () => {
    await idbStorage.setItem(
      'selected-project',
      JSON.stringify({ state: { selectedDirName: '-Users-a-beta' }, version: 0 })
    )

    const select = await renderLoaded()

    expect(select.value).toBe('-Users-a-beta')
  })

  it('falls back to the first parent project when the stored one is no longer listed', async () => {
    await idbStorage.setItem(
      'selected-project',
      JSON.stringify({ state: { selectedDirName: '-Users-gone' }, version: 0 })
    )

    const select = await renderLoaded()

    expect(select.value).toBe('-Users-a-alpha')
    expect(screen.getByText('-Users-a-alpha', { selector: 'p' })).toBeTruthy()
  })

  describe('with a stored value that cannot be trusted', () => {
    const seed = (value: string): Promise<void> => idbStorage.setItem('selected-project', value)

    it('still renders, and logs one fixed message, for a stored value that is not JSON', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await seed('not json {secret transcript text')

      const select = await renderLoaded()

      expect(select.value).toBe('-Users-a-alpha')
      expect(log).toHaveBeenCalledExactlyOnceWith(
        'Beekeeper could not restore "selected-project" from IndexedDB.'
      )
    })

    it.each([
      ['a number', 42],
      ['an object', { name: '-Users-a-beta' }]
    ])('ignores a stored selectedDirName that is %s', async (_label, selectedDirName) => {
      await seed(JSON.stringify({ state: { selectedDirName }, version: 0 }))

      await renderLoaded()

      expect(useSelectedProjectStore.getState().selectedDirName).toBeNull()
    })

    it('keeps the store actions when the stored value has keys of the same name', async () => {
      await seed(
        JSON.stringify({
          state: { selectedDirName: '-Users-a-alpha', select: 'x', resetSelection: 'y' },
          version: 0
        })
      )
      const select = await renderLoaded()

      await userEvent.selectOptions(select, '-Users-a-beta')

      expect(useSelectedProjectStore.getState().selectedDirName).toBe('-Users-a-beta')
      expect(typeof useSelectedProjectStore.getState().resetSelection).toBe('function')
    })
  })

  it('is not shown when there are no projects', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    useFirstRunStore.setState({ dismissed: true })
    renderApp()

    await screen.findByRole('heading', { name: 'No sessions found' })
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
