import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BeekeeperApi } from '../../../../../shared/ipc/beekeeperApi'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { testTotals } from '@renderer/features/overview/testTotals'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useExpandedProjectsStore } from '../state/useExpandedProjectsStore'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const WORKTREE_X = '-Users-a-alpha--claude-worktrees-x'
const WORKTREE_Y = '-Users-a-alpha--claude-worktrees-y'
const BETA = '-Users-a-beta'

const PROJECTS: readonly ProjectDto[] = [
  { ...testProject(ALPHA), label: 'acme-web' },
  testProject(WORKTREE_X, { worktreeOf: ALPHA, worktreeName: 'x' }),
  testProject(WORKTREE_Y, { worktreeOf: ALPHA, worktreeName: 'y' }),
  testProject(BETA)
]

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(async () => {
  useExpandedProjectsStore.setState({ toggled: {} })
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

async function renderLoaded(
  projects: readonly ProjectDto[] = PROJECTS,
  overrides: Partial<BeekeeperApi> = {}
): Promise<HTMLElement> {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: projects }),
    listSessions: () => Promise.resolve({ ok: true, value: [] }),
    ...overrides
  })
  renderApp()
  return screen.findByRole('navigation', { name: 'Projects' })
}

const TOGGLE_NAME = /^Worktrees of /

/** Asserts the rows, by accessible name, are exactly `expected`, in that order. The worktree toggles aren't rows. */
function expectRows(nav: HTMLElement, expected: readonly string[]): void {
  const buttons = within(nav)
    .getAllByRole('button')
    .filter((button) => !TOGGLE_NAME.test(button.getAttribute('aria-label') ?? ''))
  expect(buttons).toHaveLength(expected.length)
  expect(
    expected.map((name) => buttons.indexOf(within(nav).getByRole('button', { name })))
  ).toEqual(expected.map((_name, index) => index))
}

describe('ProjectList', () => {
  it('lists All projects first, then each top-level project by its label or folder name', async () => {
    const nav = await renderLoaded([
      { ...testProject(ALPHA), label: 'acme-web' },
      testProject(BETA)
    ])

    expectRows(nav, ['All projects', 'acme-web', BETA])
  })

  it('describes a project row by its full folder name, without adding it to the name', async () => {
    const nav = await renderLoaded()

    expect(within(nav).getByRole('button', { name: 'acme-web', description: ALPHA })).toBeTruthy()
  })

  it('keeps the folder name out of view, for screen readers only', async () => {
    const nav = await renderLoaded()

    const row = within(nav).getByRole('button', { name: 'acme-web' })
    const description = document.getElementById(row.getAttribute('aria-describedby') ?? '')
    expect(description?.classList.contains('visuallyHidden')).toBe(true)
  })

  it('uses no title tooltip, which keyboard users cannot reach', async () => {
    const nav = await renderLoaded()

    expect(within(nav).getByRole('button', { name: 'acme-web' }).hasAttribute('title')).toBe(false)
  })

  it('tells two projects with the same label apart by their folder names', async () => {
    const nav = await renderLoaded([
      { ...testProject('-Users-a-one-app'), label: 'app' },
      { ...testProject('-Users-b-two-app'), label: 'app' }
    ])

    expect(
      within(nav).getByRole('button', { name: 'app', description: '-Users-a-one-app' })
    ).toBeTruthy()
    expect(
      within(nav).getByRole('button', { name: 'app', description: '-Users-b-two-app' })
    ).toBeTruthy()
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
    const toggle = (nav: HTMLElement, project: string): HTMLElement =>
      within(nav).getByRole('button', { name: `Worktrees of ${project}` })
    const isOpen = (nav: HTMLElement, project: string): string | null =>
      toggle(nav, project).getAttribute('aria-expanded')

    it('lists the current project’s worktrees beneath it, open from the start', async () => {
      const nav = await renderLoaded()

      expect(isOpen(nav, 'acme-web')).toBe('true')
      expectRows(nav, ['All projects', 'acme-web', 'x', 'y', BETA])
    })

    it('starts a project that is not current closed, with its worktrees out of the tree', async () => {
      const nav = await renderLoaded([
        testProject(BETA),
        ...PROJECTS.filter((project) => project.dirName !== BETA)
      ])

      expect(isOpen(nav, 'acme-web')).toBe('false')
      expectRows(nav, ['All projects', BETA, 'acme-web'])
    })

    it('opens a closed project’s worktrees when its toggle is pressed, and nothing else changes', async () => {
      const nav = await renderLoaded()
      await userEvent.click(within(nav).getByRole('button', { name: BETA }))
      useFirstRunStore.setState({ dismissed: false })

      await userEvent.click(toggle(nav, 'acme-web'))

      expect(isOpen(nav, 'acme-web')).toBe('true')
      expectRows(nav, ['All projects', 'acme-web', 'x', 'y', BETA])
      expect(within(nav).getByRole('button', { name: BETA }).getAttribute('aria-current')).toBe(
        'page'
      )
      expect(useSelectedProjectStore.getState().selectedDirName).toBe(BETA)
      expect(useNavigationStore.getState().view).toBe('sessions')
      expect(useFirstRunStore.getState().dismissed).toBe(false)
    })

    it('closes an open project’s worktrees when its toggle is pressed', async () => {
      const nav = await renderLoaded()

      await userEvent.click(toggle(nav, 'acme-web'))

      expect(isOpen(nav, 'acme-web')).toBe('false')
      expectRows(nav, ['All projects', 'acme-web', BETA])
    })

    it('points the toggle at the list of worktrees it opens', async () => {
      const nav = await renderLoaded()

      const controls = toggle(nav, 'acme-web').getAttribute('aria-controls') ?? ''

      expect(
        document.getElementById(controls)?.contains(within(nav).getByRole('button', { name: 'x' }))
      ).toBe(true)
    })

    it('gives a project without worktrees no toggle', async () => {
      const nav = await renderLoaded()

      expect(within(nav).queryByRole('button', { name: `Worktrees of ${BETA}` })).toBeNull()
    })

    it('says the parent row contains the current worktree when that group is closed', async () => {
      const nav = await renderLoaded()
      await userEvent.click(within(nav).getByRole('button', { name: 'x' }))

      await userEvent.click(toggle(nav, 'acme-web'))

      expect(within(nav).queryByRole('button', { name: 'x' })).toBeNull()
      const parent = within(nav).getByRole('button', {
        name: 'acme-web contains the current worktree'
      })
      expect(parent.getAttribute('aria-current')).toBeNull()
    })

    it('does not say the parent holds the current worktree while the group is open', async () => {
      const nav = await renderLoaded()
      await userEvent.click(within(nav).getByRole('button', { name: 'x' }))

      expect(within(nav).getByRole('button', { name: 'acme-web' })).toBeTruthy()
      expect(within(nav).getByRole('button', { name: 'x' }).getAttribute('aria-current')).toBe(
        'page'
      )
    })

    it('shows no worktrees under a project that is not current', async () => {
      const nav = await renderLoaded()

      await userEvent.click(within(nav).getByRole('button', { name: BETA }))

      expectRows(nav, ['All projects', 'acme-web', BETA])
    })

    it('closes every group while the overview shows', async () => {
      const nav = await renderLoaded()

      await userEvent.click(within(nav).getByRole('button', { name: 'All projects' }))

      expectRows(nav, ['All projects', 'acme-web', BETA])
    })

    it('marks a worktree current, not its parent, when the worktree is selected', async () => {
      const nav = await renderLoaded()

      await userEvent.click(within(nav).getByRole('button', { name: 'x' }))

      expect(within(nav).getByRole('button', { name: 'x' }).getAttribute('aria-current')).toBe(
        'page'
      )
      expect(
        within(nav).getByRole('button', { name: 'acme-web' }).getAttribute('aria-current')
      ).toBeNull()
      expect(useSelectedProjectStore.getState().selectedDirName).toBe(WORKTREE_X)
      expectRows(nav, ['All projects', 'acme-web', 'x', 'y', BETA])
    })

    it('describes a worktree row by its full folder name', async () => {
      const nav = await renderLoaded()

      expect(within(nav).getByRole('button', { name: 'x', description: WORKTREE_X })).toBeTruthy()
    })

    it('lists a worktree with no listed parent as a top-level row named by its worktree, with no toggle', async () => {
      const nav = await renderLoaded([
        testProject(WORKTREE_X, { worktreeOf: ALPHA, worktreeName: 'x' }),
        testProject(BETA)
      ])

      expectRows(nav, ['All projects', 'x', BETA])
      expect(within(nav).queryByRole('button', { name: TOGGLE_NAME })).toBeNull()
    })

    it('shows a worktree’s own total beside it, apart from its project’s', async () => {
      const nav = await renderLoaded(PROJECTS, {
        getProjectTotals: (dirName: string) =>
          Promise.resolve({
            ok: true,
            value: testTotals({ tokens: dirName === WORKTREE_X ? 1_200_000 : 900_000 })
          })
      })

      expect(
        await within(nav).findByRole('button', { name: 'x 1.2M tokens, last 7 days' })
      ).toBeTruthy()
      expect(within(nav).getByRole('button', { name: 'y 900K tokens, last 7 days' })).toBeTruthy()
    })

    it('shows no total for a worktree whose totals are loading or failed', async () => {
      const nav = await renderLoaded(PROJECTS, {
        getProjectTotals: (dirName: string) =>
          dirName === WORKTREE_X
            ? new Promise(() => undefined)
            : dirName === WORKTREE_Y
              ? Promise.reject(new Error('unreadable'))
              : Promise.resolve({ ok: true, value: testTotals({ tokens: 5 }) })
      })

      await within(nav).findByRole('button', { name: /^-Users-a-beta .*tokens/ })

      expect(within(nav).getByRole('button', { name: 'x' })).toBeTruthy()
      expect(within(nav).getByRole('button', { name: 'y' })).toBeTruthy()
    })
  })

  it('is not shown when there are no projects', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    renderApp()

    await screen.findByRole('heading', { name: 'No sessions found' })
    expect(screen.queryByRole('navigation', { name: 'Projects' })).toBeNull()
  })
})
