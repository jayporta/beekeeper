import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { ProjectTotalsDto } from '../../../../../shared/ipc/projectTotalsDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { OverviewView } from '../OverviewView'
import { useTotalsWindowStore } from '../state/useTotalsWindowStore'
import { testTotals } from '../testTotals'

const ALPHA = '-Users-a-alpha'
const WORKTREE_X = '-Users-a-alpha--claude-worktrees-x'
const BETA = '-Users-a-beta'
const ORPHAN = '-Users-a-gone--claude-worktrees-orphan'

const ALPHA_PROJECT: ProjectDto = { ...testProject(ALPHA), label: 'acme-web' }
const BETA_PROJECT: ProjectDto = { ...testProject(BETA), label: 'beta-app' }
const PROJECTS: readonly ProjectDto[] = [
  ALPHA_PROJECT,
  testProject(WORKTREE_X, { worktreeOf: ALPHA, worktreeName: 'x' }),
  BETA_PROJECT
]

/** Each folder's totals. A folder left out has nothing in the window. */
const TOTALS: Readonly<Record<string, Partial<ProjectTotalsDto>>> = {
  [ALPHA]: { tokens: 1_200_000, usd: 10, sessions: 3, agents: 7 },
  [WORKTREE_X]: { tokens: 300_000, usd: 2.5, sessions: 1, agents: 2 },
  [BETA]: { tokens: 500_000, usd: 4, sessions: 2, agents: 2 }
}

const SHARE_BAR = '[aria-hidden] > div'
const COULDNT_LOAD = "Couldn't load this project's totals."
const share = (percent: number): string => `${percent}% of the busiest project's tokens`

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useNavigationStore.getState().showOverview()
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  useTotalsWindowStore.setState({ window: '7d' })
  useSelectedProjectStore.setState({ selectedDirName: null })
  await resetPersistedState()
})

type TotalsReply = IpcResult<ProjectTotalsDto>
const ok = (overrides: Partial<ProjectTotalsDto>): TotalsReply => ({
  ok: true,
  value: testTotals(overrides)
})
const failed: TotalsReply = { ok: false, error: { code: 'not-found' } }
const never = (): Promise<TotalsReply> => new Promise(() => undefined)
const normal = (dirName: string): Promise<TotalsReply> => Promise.resolve(ok(TOTALS[dirName] ?? {}))

/** Renders the whole app on the overview. `totals` answers each folder's request. */
function renderOverview(
  options: {
    projects?: readonly ProjectDto[]
    totals?: (dirName: string, window: string) => Promise<TotalsReply>
  } = {}
): ReturnType<typeof installBeekeeperApi> {
  const { projects = PROJECTS, totals = normal } = options
  const api = installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: projects }),
    listSessions: () => Promise.resolve({ ok: true, value: [] }),
    getProjectTotals: totals
  })
  renderApp()
  return api
}

const main = (): HTMLElement => screen.getByRole('main')

/** The card of the project named `name`, once it is on screen. */
async function findCard(name: string): Promise<HTMLElement> {
  const button = await within(main()).findByRole('button', { name })
  const item = button.closest('li')
  if (item === null) throw new Error(`No card around ${name}`)
  return item
}

/** The sidebar's navigation, once the projects have loaded. */
const findSidebar = (): Promise<HTMLElement> =>
  screen.findByRole('navigation', { name: 'Projects' })

const shareBar = (card: HTMLElement): HTMLElement | null => card.querySelector(SHARE_BAR)

/** Waits until the first project's totals are in, so the cards have figures. */
async function totalsLoaded(): Promise<void> {
  await within(main()).findByText('1.5M tokens')
}

describe('OverviewView header', () => {
  it('names the view and the window the figures cover', async () => {
    renderOverview()

    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
    expect(screen.getByText('Overview · last 7 days')).toBeTruthy()
  })

  it('offers 7 days and 30 days, with 7 days chosen', async () => {
    renderOverview()

    const group = await screen.findByRole('radiogroup', { name: 'Time window' })

    expect(
      (within(group).getAllByRole('radio') as HTMLInputElement[]).map((radio) => radio.checked)
    ).toEqual([true, false])
    expect(within(group).getByRole('radio', { name: '30 days' })).toBeTruthy()
  })
})

describe('OverviewView totals strip', () => {
  it('adds every project and worktree', async () => {
    renderOverview()
    await totalsLoaded()

    const strip = within(main()).getByRole('list', { name: 'Totals, last 7 days' })

    expect(within(strip).getByText('2M')).toBeTruthy()
    expect(within(strip).getByText('$16.50 at API prices')).toBeTruthy()
    expect(within(strip).getByText('6')).toBeTruthy()
    expect(within(strip).getByText('11')).toBeTruthy()
    expect(within(strip).getByText('agents, incl. teammates and subagents')).toBeTruthy()
  })
})

describe('OverviewView cards', () => {
  it("adds a project's worktrees into its card", async () => {
    renderOverview()
    await totalsLoaded()

    const alpha = within(await findCard('acme-web'))
    expect(alpha.getByText('$12.50 at API prices')).toBeTruthy()
    expect(alpha.getByText('4 sessions')).toBeTruthy()
    expect(alpha.getByText('9 agents')).toBeTruthy()
    expect(alpha.getByText('1 worktree')).toBeTruthy()
    expect(alpha.getByText(ALPHA)).toBeTruthy()
  })

  it('shows no worktree count for a project without worktrees', async () => {
    renderOverview()
    await totalsLoaded()

    expect(within(await findCard('beta-app')).queryByText(/worktree/)).toBeNull()
  })

  it("sizes each share bar against the busiest project's tokens", async () => {
    renderOverview()
    await totalsLoaded()

    const alpha = await findCard('acme-web')
    const beta = await findCard('beta-app')

    expect(within(alpha).getByText(share(100))).toBeTruthy()
    expect(shareBar(alpha)?.style.inlineSize).toBe('100%')
    expect(within(beta).getByText(share(33))).toBeTruthy()
    expect(shareBar(beta)?.style.inlineSize).toBe(`${(500_000 / 1_500_000) * 100}%`)
  })

  it('gives a single project a full bar', async () => {
    renderOverview({ projects: [BETA_PROJECT] })
    await within(main()).findByText('500K tokens')

    expect(shareBar(await findCard('beta-app'))?.style.inlineSize).toBe('100%')
  })

  it('shows zero and an empty bar for every project when nothing ran in the window', async () => {
    renderOverview({ totals: () => Promise.resolve(ok({})) })

    expect(await within(main()).findByText('No activity in this window')).toBeTruthy()
    const alpha = await findCard('acme-web')
    expect(within(alpha).getByText('0 tokens')).toBeTruthy()
    expect(within(alpha).getByText(share(0))).toBeTruthy()
    expect(shareBar(alpha)?.style.inlineSize).toBe('0%')
    expect(main().textContent).not.toMatch(/NaN|Infinity/)
  })

  it("shows a worktree whose parent isn't listed as its own project, as the sidebar does", async () => {
    renderOverview({
      projects: [
        ...PROJECTS,
        testProject(ORPHAN, { worktreeOf: '-Users-a-gone', worktreeName: 'orphan' })
      ]
    })
    await totalsLoaded()

    expect(await findCard('orphan')).toBeTruthy()
    expect(within(await findSidebar()).getByRole('button', { name: /^orphan/ })).toBeTruthy()
  })

  it('names the latest session as plain text, or says it is untitled', async () => {
    const latest: Readonly<Record<string, ProjectTotalsDto['latest']>> = {
      [ALPHA]: { sessionId: 's1', title: '<b>Fix login</b>', latestMs: Date.UTC(2026, 0, 15, 12) },
      [BETA]: { sessionId: 's2', title: null, latestMs: Date.UTC(2026, 0, 14, 12) }
    }
    renderOverview({
      totals: (dirName) =>
        Promise.resolve(ok({ ...TOTALS[dirName], latest: latest[dirName] ?? null }))
    })
    await totalsLoaded()

    expect(
      within(await findCard('acme-web')).getByText(/^Latest: <b>Fix login<\/b> · Jan 1[45], 2026/)
    ).toBeTruthy()
    expect(
      within(await findCard('beta-app')).getByText(/^Latest: untitled session · Jan 1[34], 2026/)
    ).toBeTruthy()
  })

  it('says a project has no session in the window when it has no latest one', async () => {
    renderOverview()
    await totalsLoaded()

    expect(within(await findCard('beta-app')).getByText('No sessions in this window')).toBeTruthy()
  })

  it('selects the project and opens its sessions when the card is pressed', async () => {
    renderOverview()
    await totalsLoaded()

    await userEvent.click(within(main()).getByRole('button', { name: 'beta-app' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
    expect(useSelectedProjectStore.getState().selectedDirName).toBe(BETA)
    expect(await screen.findByRole('heading', { level: 1, name: 'beta-app' })).toBeTruthy()
  })
})

describe('OverviewView partial totals', () => {
  it("marks the figures and gives the footnote when a session couldn't be read", async () => {
    renderOverview({
      totals: (dirName) =>
        Promise.resolve(
          ok({
            ...TOTALS[dirName],
            partial: { ...testTotals().partial, unreadable: dirName === BETA ? 1 : 0 }
          })
        )
    })
    await totalsLoaded()

    expect(main().textContent).toContain("¹ Partial: Some sessions couldn't be read.")
    expect(
      within(await findCard('beta-app')).getAllByText('partial, see the note below').length
    ).toBeGreaterThan(0)
    expect(within(await findCard('acme-web')).queryByText('partial, see the note below')).toBeNull()
  })

  it("marks a card's tokens but not its counts when only the tokens may be low", async () => {
    renderOverview({
      totals: (dirName) =>
        Promise.resolve(
          ok({
            ...TOTALS[dirName],
            partial: { ...testTotals().partial, withoutTokens: dirName === BETA ? 1 : 0 }
          })
        )
    })
    await totalsLoaded()

    const beta = within(await findCard('beta-app'))

    expect(beta.getByText('500K tokens').textContent).toContain('¹')
    expect(beta.getByText('2 sessions').textContent).not.toContain('¹')
    expect(beta.getByText('2 agents').textContent).not.toContain('¹')
  })

  it("marks a card's counts as well when a session couldn't be read", async () => {
    renderOverview({
      totals: (dirName) =>
        Promise.resolve(
          ok({
            ...TOTALS[dirName],
            partial: { ...testTotals().partial, unreadable: dirName === BETA ? 1 : 0 }
          })
        )
    })
    await totalsLoaded()

    const beta = within(await findCard('beta-app'))

    expect(beta.getByText('2 sessions').textContent).toContain('¹')
    expect(beta.getByText('2 agents').textContent).toContain('¹')
  })

  it('gives no footnote when every figure is complete', async () => {
    renderOverview()
    await totalsLoaded()

    expect(screen.queryByText(/Partial:/)).toBeNull()
  })
})

describe('OverviewView loading and errors', () => {
  it('shows a loading card until its totals arrive, while the others fill in', async () => {
    renderOverview({ totals: (dirName) => (dirName === BETA ? never() : normal(dirName)) })

    await within(main()).findByText('1.5M tokens')
    const beta = await findCard('beta-app')
    expect(within(beta).getByText('Loading')).toBeTruthy()
    expect(within(beta).queryByText(/tokens/)).toBeNull()
    expect(main().textContent).toContain('Some projects are still loading.')
  })

  it('shows loading placeholders in the strip before any project has totals', async () => {
    renderOverview({ totals: never })

    const strip = await within(main()).findByRole('list', { name: 'Totals, last 7 days' })

    expect(within(strip).getAllByText('Loading')).toHaveLength(3)
  })

  it("shows an error on a card whose folder can't be read, with the others and the strip intact", async () => {
    renderOverview({
      totals: (dirName) => (dirName === BETA ? Promise.resolve(failed) : normal(dirName))
    })
    await totalsLoaded()

    expect(within(await findCard('beta-app')).getByText(COULDNT_LOAD)).toBeTruthy()
    expect(within(await findCard('acme-web')).getByText('1.5M tokens')).toBeTruthy()
    const strip = within(main()).getByRole('list', { name: 'Totals, last 7 days' })
    expect(within(strip).getByText('1.5M')).toBeTruthy()
    expect(main().textContent).toContain("Some projects couldn't be read.")
  })

  it('still opens the sessions of a project whose totals failed', async () => {
    renderOverview({ totals: () => Promise.resolve(failed) })
    await within(await findCard('beta-app')).findByText(COULDNT_LOAD)

    await userEvent.click(within(main()).getByRole('button', { name: 'beta-app' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('shows the strip as unavailable when every project failed', async () => {
    renderOverview({ totals: () => Promise.resolve(failed) })

    const strip = await within(main()).findByRole('list', { name: 'Totals, last 7 days' })

    await waitFor(() => {
      expect(within(strip).getAllByText('Unavailable')).toHaveLength(3)
    })
  })
})

describe('OverviewView without projects', () => {
  it('says there is no activity and shows no totals', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    render(<OverviewView />, { wrapper: createQueryWrapper() })

    expect(await screen.findByText('No activity in this window')).toBeTruthy()
    expect(screen.queryByRole('list', { name: /Totals/ })).toBeNull()
  })
})

describe('OverviewView window', () => {
  it('asks for the other window and relabels the kicker when 30 days is chosen', async () => {
    const api = renderOverview()
    await totalsLoaded()

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))

    expect(screen.getByText('Overview · last 30 days')).toBeTruthy()
    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledWith(ALPHA, '30d')
    })
  })

  it("keeps the cards' figures on screen, not loading, until the new window's arrive", async () => {
    let release: (reply: TotalsReply) => void = () => undefined
    const thirtyDays = new Promise<TotalsReply>((resolve) => {
      release = resolve
    })
    renderOverview({
      totals: (dirName, window) =>
        window === '30d' && dirName === BETA ? thirtyDays : normal(dirName)
    })
    await totalsLoaded()

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))

    expect(within(await findCard('beta-app')).getByText('500K tokens')).toBeTruthy()
    expect(within(main()).queryByText('Loading')).toBeNull()
    act(() => {
      release(ok({ tokens: 900_000 }))
    })
    expect(await within(await findCard('beta-app')).findByText('900K tokens')).toBeTruthy()
  })
})

describe('sidebar figures', () => {
  it("shows each project's token total, matching its card, and the overall total on All projects", async () => {
    renderOverview()
    await totalsLoaded()
    const sidebar = within(await findSidebar())

    await waitFor(() => {
      expect(
        sidebar.getByRole('button', { name: 'acme-web 1.5M tokens, last 7 days' })
      ).toBeTruthy()
    })
    expect(sidebar.getByRole('button', { name: 'beta-app 500K tokens, last 7 days' })).toBeTruthy()
    expect(
      sidebar.getByRole('button', { name: 'All projects 2M tokens, last 7 days' })
    ).toBeTruthy()
  })

  it("shows the figure compactly as the row's note", async () => {
    renderOverview()
    await totalsLoaded()

    const row = await within(await findSidebar()).findByRole('button', { name: /^beta-app/ })

    expect(within(row).getByText('500K')).toBeTruthy()
  })

  it('shows nothing on a row while its totals load', async () => {
    renderOverview({ totals: never })
    const sidebar = within(await findSidebar())

    expect(sidebar.getByRole('button', { name: 'beta-app' })).toBeTruthy()
    expect(sidebar.getByRole('button', { name: 'All projects' })).toBeTruthy()
  })

  it('shows nothing on the row of a project whose totals failed', async () => {
    renderOverview({
      totals: (dirName) => (dirName === BETA ? Promise.resolve(failed) : normal(dirName))
    })
    await totalsLoaded()

    expect(within(await findSidebar()).getByRole('button', { name: 'beta-app' })).toBeTruthy()
  })

  it('marks a row whose total may be low', async () => {
    renderOverview({
      totals: (dirName) =>
        Promise.resolve(
          ok({
            ...TOTALS[dirName],
            partial: { ...testTotals().partial, withoutTokens: dirName === BETA ? 1 : 0 }
          })
        )
    })
    await totalsLoaded()

    const row = await within(await findSidebar()).findByRole('button', {
      name: 'beta-app 500K tokens, last 7 days partial'
    })

    expect(row.textContent).toContain('500K¹')
  })

  it('follows the window', async () => {
    renderOverview({
      totals: (_dirName, window) =>
        Promise.resolve(ok({ tokens: window === '7d' ? 1_000 : 2_000_000 }))
    })
    const sidebar = within(await findSidebar())
    await sidebar.findByRole('button', { name: 'beta-app 1K tokens, last 7 days' })

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))

    expect(
      await sidebar.findByRole('button', { name: 'beta-app 2M tokens, last 30 days' })
    ).toBeTruthy()
  })
})
