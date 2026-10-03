import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { SessionsView } from '../SessionsView'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import { testSession } from '../testSessionFixtures'

const DIR = '-Users-a-acme'
const WORKTREE_DIR = '-Users-a-acme--claude-worktrees-fix-bug'
const acme: ProjectDto = { ...testProject(DIR), label: 'Acme Web' }
const worktree: ProjectDto = {
  ...testProject(WORKTREE_DIR, { worktreeOf: DIR, worktreeName: 'fix-bug' }),
  label: 'Acme Web'
}

const ok = (
  value: readonly SessionListItemDto[]
): Promise<IpcResult<readonly SessionListItemDto[]>> => Promise.resolve({ ok: true, value })

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

/** Renders the app on `projects` with `listSessions` answering for every folder. */
function showProjects(
  projects: readonly ProjectDto[],
  sessions: () => Promise<IpcResult<readonly SessionListItemDto[]>> = () =>
    ok([testSession(1, { projectDirName: DIR })])
): void {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: projects }),
    listSessions: sessions
  })
  renderApp()
}

const breadcrumb = (): HTMLElement => screen.getByRole('navigation', { name: 'Breadcrumb' })
/** Waits for the main heading with this name, so the projects gate's own heading doesn't match. */
const heading = (name: string): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 1, name })

describe('SessionsView heading', () => {
  it('names the project and shows its folder name exactly as on disk beneath it', async () => {
    showProjects([acme])

    const title = await heading('Acme Web')
    const header = title.closest('header') as HTMLElement

    expect(title.textContent).toBe('Acme Web')
    expect(within(header).getByText(DIR)).toBeTruthy()
  })

  it('names the project by its folder name when it has no label', async () => {
    showProjects([testProject(DIR)])

    expect((await heading(DIR)).textContent).toBe(DIR)
  })

  it('keeps the main heading id on the project name', async () => {
    showProjects([acme])

    expect((await heading('Acme Web')).id).toBe('main-heading')
  })

  it('puts the search box and Refresh in the header, beside the title', async () => {
    showProjects([acme])

    const header = (await heading('Acme Web')).closest('header') as HTMLElement

    expect(await within(header).findByRole('searchbox', { name: 'Search sessions' })).toBeTruthy()
    expect(within(header).getByRole('button', { name: 'Refresh' })).toBeTruthy()
  })

  it('falls back to "Sessions" with no breadcrumb while no project is known', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    render(<SessionsView />, { wrapper: createQueryWrapper() })

    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
  })
})

describe('SessionsView breadcrumb', () => {
  it('reads "All projects" then the project, which is the current page', async () => {
    showProjects([acme])
    await heading('Acme Web')

    const items = within(breadcrumb())
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    const current = within(breadcrumb()).getByText('Acme Web')

    expect(items).toEqual(['All projects', 'Acme Web'])
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('shows the overview when "All projects" is pressed', async () => {
    showProjects([acme])
    await heading('Acme Web')

    await userEvent.click(within(breadcrumb()).getByRole('button', { name: 'All projects' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
    expect(useNavigationStore.getState().view).toBe('overview')
  })

  it('renders a markup-like project label as plain text', async () => {
    const hostile = '<img src=x onerror=alert(1)>'
    showProjects([{ ...testProject(DIR), label: hostile }])

    expect((await heading(hostile)).textContent).toBe(hostile)
    expect(within(breadcrumb()).getByText(hostile)).toBeTruthy()
  })
})

describe('SessionsView breadcrumb for a worktree', () => {
  beforeEach(() => {
    useSelectedProjectStore.setState({ selectedDirName: WORKTREE_DIR })
  })

  it('reads "All projects", the parent, then the worktree, and names the worktree', async () => {
    showProjects([acme, worktree])

    const title = await heading('fix-bug')
    const items = within(breadcrumb())
      .getAllByRole('listitem')
      .map((item) => item.textContent)

    expect(title.textContent).toBe('fix-bug')
    expect(items).toEqual(['All projects', 'Acme Web', 'fix-bug'])
    expect(within(breadcrumb()).getByText('fix-bug').getAttribute('aria-current')).toBe('page')
  })

  it("selects the parent and shows its sessions when the parent's name is pressed", async () => {
    showProjects([acme, worktree])
    await heading('fix-bug')

    await userEvent.click(within(breadcrumb()).getByRole('button', { name: 'Acme Web' }))

    expect(useSelectedProjectStore.getState().selectedDirName).toBe(DIR)
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Web' })).toBeTruthy()
    expect(within(breadcrumb()).getAllByRole('listitem')).toHaveLength(2)
  })

  it('has no parent step when the parent folder is not listed', async () => {
    showProjects([worktree])
    await heading('fix-bug')

    expect(
      within(breadcrumb())
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['All projects', 'fix-bug'])
  })
})

describe('SessionsView search box', () => {
  it('is not on screen while the sessions load', async () => {
    showProjects([acme], () => new Promise(() => undefined))

    await screen.findByRole('heading', { name: 'Loading sessions' })

    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('is not on screen when loading the sessions failed', async () => {
    showProjects([acme], () => Promise.resolve({ ok: false, error: { code: 'unreadable' } }))

    await screen.findByRole('alert')

    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('is not on screen for a project with no sessions', async () => {
    showProjects([acme], () => ok([]))

    await screen.findByRole('heading', { name: 'No sessions in this project' })

    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('shows once the sessions have loaded', async () => {
    showProjects([acme])

    expect(await screen.findByRole('searchbox', { name: 'Search sessions' })).toBeTruthy()
  })
})
