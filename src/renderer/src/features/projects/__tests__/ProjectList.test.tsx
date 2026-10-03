import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const WORKTREE_X = '-Users-a-alpha--claude-worktrees-x'
const WORKTREE_Y = '-Users-a-alpha--claude-worktrees-y'
const BETA = '-Users-a-beta'

const PROJECTS: readonly ProjectDto[] = [
  { ...testProject(ALPHA), label: 'acme-web' },
  testProject(WORKTREE_X, ALPHA),
  testProject(WORKTREE_Y, ALPHA),
  testProject(BETA)
]

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

async function renderLoaded(projects: readonly ProjectDto[] = PROJECTS): Promise<HTMLElement> {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: projects }),
    listSessions: () => Promise.resolve({ ok: true, value: [] })
  })
  renderApp()
  return screen.findByRole('navigation', { name: 'Projects' })
}

const names = (nav: HTMLElement): (string | undefined)[] =>
  within(nav)
    .getAllByRole('button')
    .map((button) => button.textContent ?? undefined)

describe('ProjectList', () => {
  it('lists All projects first, then each top-level project by its label or folder name', async () => {
    const nav = await renderLoaded([
      { ...testProject(ALPHA), label: 'acme-web' },
      testProject(BETA)
    ])

    expect(names(nav)).toEqual(['All projects', 'acme-web', BETA])
  })

  it('shows the full folder name on hover of a project row', async () => {
    const nav = await renderLoaded()

    expect(within(nav).getByRole('button', { name: 'acme-web' }).getAttribute('title')).toBe(ALPHA)
  })

  it('renders a transcript-derived label as plain text', async () => {
    const nav = await renderLoaded([
      { ...testProject(ALPHA), label: '<img src=x onerror=alert(1)>' }
    ])

    expect(within(nav).getByRole('button', { name: '<img src=x onerror=alert(1)>' })).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
  })

  it('marks the first parent project current when nothing is stored', async () => {
    const nav = await renderLoaded()

    expect(within(nav).getByRole('button', { name: 'acme-web' }).getAttribute('aria-current')).toBe(
      'page'
    )
    expect(within(nav).getByRole('button', { name: BETA }).getAttribute('aria-current')).toBeNull()
    expect(
      within(nav).getByRole('button', { name: 'All projects' }).getAttribute('aria-current')
    ).toBeNull()
  })

  it('selects a project when its row is pressed', async () => {
    const nav = await renderLoaded()

    await userEvent.click(within(nav).getByRole('button', { name: BETA }))

    expect(useSelectedProjectStore.getState().selectedDirName).toBe(BETA)
    expect(within(nav).getByRole('button', { name: BETA }).getAttribute('aria-current')).toBe(
      'page'
    )
    expect(await screen.findByText(BETA, { selector: 'p' })).toBeTruthy()
  })

  it('shows the sessions list when the project in effect is pressed from the overview', async () => {
    const nav = await renderLoaded()
    useNavigationStore.getState().showOverview()

    await userEvent.click(within(nav).getByRole('button', { name: 'acme-web' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
    expect(within(nav).getByRole('button', { name: 'acme-web' }).getAttribute('aria-current')).toBe(
      'page'
    )
  })

  it('shows the overview and marks All projects current when its row is pressed', async () => {
    const nav = await renderLoaded()

    await userEvent.click(within(nav).getByRole('button', { name: 'All projects' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
    expect(
      within(nav).getByRole('button', { name: 'All projects' }).getAttribute('aria-current')
    ).toBe('page')
    expect(
      within(nav).getByRole('button', { name: 'acme-web' }).getAttribute('aria-current')
    ).toBeNull()
  })

  it('leaves the session view for the sessions list when the current project is pressed', async () => {
    const nav = await renderLoaded()
    useNavigationStore.getState().showSession({ projectDirName: ALPHA, sessionId: 'x' })

    await userEvent.click(within(nav).getByRole('button', { name: 'acme-web' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  describe('worktrees', () => {
    it('lists the active project’s worktrees beneath it with a worktree note', async () => {
      const nav = await renderLoaded()

      expect(names(nav)).toEqual(['All projects', 'acme-web', 'x worktree', 'y worktree', BETA])
    })

    it('shows no worktrees under a project that is not active', async () => {
      const nav = await renderLoaded()

      await userEvent.click(within(nav).getByRole('button', { name: BETA }))

      expect(names(nav)).toEqual(['All projects', 'acme-web', BETA])
    })

    it('hides every worktree while the overview shows', async () => {
      const nav = await renderLoaded()

      await userEvent.click(within(nav).getByRole('button', { name: 'All projects' }))

      expect(names(nav)).toEqual(['All projects', 'acme-web', BETA])
    })

    it('marks a worktree current, not its parent, when the worktree is selected', async () => {
      const nav = await renderLoaded()

      await userEvent.click(within(nav).getByRole('button', { name: 'x worktree' }))

      expect(
        within(nav).getByRole('button', { name: 'x worktree' }).getAttribute('aria-current')
      ).toBe('page')
      expect(
        within(nav).getByRole('button', { name: 'acme-web' }).getAttribute('aria-current')
      ).toBeNull()
      expect(names(nav)).toEqual(['All projects', 'acme-web', 'x worktree', 'y worktree', BETA])
    })

    it('shows the worktree’s folder name on hover', async () => {
      const nav = await renderLoaded()

      expect(within(nav).getByRole('button', { name: 'x worktree' }).getAttribute('title')).toBe(
        WORKTREE_X
      )
    })

    it('lists a worktree with no listed parent as a top-level row', async () => {
      const nav = await renderLoaded([testProject(WORKTREE_X, ALPHA), testProject(BETA)])

      expect(names(nav)).toEqual(['All projects', WORKTREE_X, BETA])
    })
  })

  it('is not shown when there are no projects', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    renderApp()

    await screen.findByRole('heading', { name: 'No sessions found' })
    expect(screen.queryByRole('navigation', { name: 'Projects' })).toBeNull()
  })
})
