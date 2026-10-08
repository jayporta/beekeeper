import { act, render, screen, waitFor, within } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BeekeeperApi } from '../../../../../shared/ipc/beekeeperApi'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { ProjectDailyUsageDto } from '../../../../../shared/ipc/projectDailyUsageDto'
import type { ProjectTotalsDto } from '../../../../../shared/ipc/projectTotalsDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { OverviewView } from '../OverviewView'
import { useTotalsWindowStore } from '../state/useTotalsWindowStore'
import { testDailyUsage } from '../dailyUsage/testDailyUsage'
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
const MAY_BE_LOW = 'Totals for the last 7 days updated. Some may be low, see the note below.'
const share = (percent: number): string => `${percent}% of the busiest project's tokens`

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useNavigationStore.getState().showOverview()
})

afterEach(async () => {
  vi.useRealTimers()
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

/** Daily usage that comes back at once, with nothing in it, so a test about something else need not wait for it. */
const quietUsage: BeekeeperApi['getProjectDailyUsage'] = () =>
  Promise.resolve({ ok: true, value: testDailyUsage({ '2026-03-10': {} }) })

/** Renders the whole app on the overview. `totals` answers each folder's request. */
function renderOverview(
  options: {
    projects?: readonly ProjectDto[]
    totals?: (dirName: string, window: string) => Promise<TotalsReply>
    dailyUsage?: BeekeeperApi['getProjectDailyUsage']
    client?: QueryClient
  } = {}
): ReturnType<typeof installBeekeeperApi> {
  const { projects = PROJECTS, totals = normal, dailyUsage = quietUsage, client } = options
  const api = installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: projects }),
    listSessions: () => Promise.resolve({ ok: true, value: [] }),
    getProjectTotals: totals,
    getProjectDailyUsage: dailyUsage
  })
  renderApp(client)
  return api
}

const main = (): HTMLElement => screen.getByRole('main')

/** A reply held back until `release` is called. */
function gate<T = TotalsReply>(): { reply: Promise<T>; release: (reply: T) => void } {
  let release: (reply: T) => void = () => undefined
  const reply = new Promise<T>((resolve) => {
    release = resolve
  })
  return { reply, release }
}

/** Every folder's totals, with one count of `field` on `dirName`'s. */
function withPartial(
  field: keyof ProjectTotalsDto['partial'],
  dirName = BETA
): (folder: string) => Promise<TotalsReply> {
  return (folder) =>
    Promise.resolve(
      ok({
        ...TOTALS[folder],
        partial: { ...testTotals().partial, [field]: folder === dirName ? 1 : 0 }
      })
    )
}

/** The strip of totals and the note beside it, found by the strip's name. */
function stripArea(name: string): HTMLElement {
  const area = within(main()).getByRole('list', { name }).parentElement
  if (area === null) throw new Error('The strip has no wrapper')
  return area
}

/** The overview itself: the view around its header. */
function overviewView(): HTMLElement {
  const view = screen
    .getByRole('heading', { level: 1, name: 'All projects' })
    .closest('header')?.parentElement
  if (view === null || view === undefined) throw new Error('The overview has no view around it')
  return view
}

/** The overview's one status region, which is mounted before it has anything to say. */
function statusRegion(): HTMLElement {
  return within(overviewView()).getByRole('status')
}

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
  })

  it('describes a card by its figures, then its full folder name, without adding them to the name', async () => {
    renderOverview()

    expect(
      await within(main()).findByRole('button', {
        name: 'acme-web',
        description: new RegExp(
          `^1\\.5M tokens.*\\$12\\.50 at API prices.*4 sessions.*9 agents.*${share(100)}.*${ALPHA}$`
        )
      })
    ).toBeTruthy()
  })

  it('also describes a card by the footnote when its figures may be low', async () => {
    renderOverview({ totals: withPartial('unreadable') })
    await totalsLoaded()

    expect(
      await within(main()).findByRole('button', {
        name: 'beta-app',
        description: /-Users-a-beta.*¹ Partial: Some sessions couldn't be read\./
      })
    ).toBeTruthy()
  })

  it('leaves the footnote out of the description of a card whose figures are complete', async () => {
    renderOverview({ totals: withPartial('unreadable') })
    await totalsLoaded()

    const alpha = within(main()).getByRole('button', { name: 'acme-web' })

    expect(alpha.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2)
  })

  it('keeps the folder name out of view, for screen readers only', async () => {
    renderOverview()
    await totalsLoaded()

    const button = within(main()).getByRole('button', { name: 'acme-web' })
    const described = (button.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id))
    const folder = described.find((element) => element?.textContent === ALPHA)
    expect(folder?.classList.contains('visuallyHidden')).toBe(true)
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
      within(await findCard('acme-web')).getByText(
        /^Latest: \u2068<b>Fix login<\/b>\u2069 · Jan 1[45], 2026/
      )
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

  it("marks a card's cost but not its tokens or counts when only the cost may be low", async () => {
    renderOverview({ totals: withPartial('withoutCost') })
    await totalsLoaded()

    const beta = within(await findCard('beta-app'))

    expect(beta.getByText('$4.00 at API prices').textContent).toContain('¹')
    expect(beta.getByText('500K tokens').textContent).not.toContain('¹')
    expect(beta.getByText('2 sessions').textContent).not.toContain('¹')
    expect(beta.getByText('2 agents').textContent).not.toContain('¹')
  })

  it('marks every figure of a card when only a session has no timestamps', async () => {
    renderOverview({ totals: withPartial('undated') })
    await totalsLoaded()

    const beta = within(await findCard('beta-app'))

    expect(beta.getByText('500K tokens').textContent).toContain('¹')
    expect(beta.getByText('$4.00 at API prices').textContent).toContain('¹')
    expect(beta.getByText('2 sessions').textContent).toContain('¹')
    expect(beta.getByText('2 agents').textContent).toContain('¹')
  })

  it("marks the strip's cost but not its tokens when only the cost may be low", async () => {
    renderOverview({ totals: withPartial('withoutCost') })
    await totalsLoaded()

    const strip = within(within(main()).getByRole('list', { name: 'Totals, last 7 days' }))

    expect(strip.getByText('$16.50 at API prices').textContent).toContain('¹')
    expect(strip.getByText('2M').textContent).not.toContain('¹')
  })

  it("marks the strip's tokens but not its cost when only the tokens may be low", async () => {
    renderOverview({ totals: withPartial('lowTokens') })
    await totalsLoaded()

    const strip = within(within(main()).getByRole('list', { name: 'Totals, last 7 days' }))

    expect(strip.getByText('2M').textContent).toContain('¹')
    expect(strip.getByText('$16.50 at API prices').textContent).not.toContain('¹')
  })

  it("marks a card's agents but not its tokens, cost or sessions when subagents went uncounted", async () => {
    renderOverview({ totals: withPartial('uncountedSubagents') })
    await totalsLoaded()

    const beta = within(await findCard('beta-app'))

    expect(beta.getByText('500K tokens').textContent).not.toContain('¹')
    expect(beta.getByText('2 agents').textContent).toContain('¹')
    expect(beta.getByText('2 sessions').textContent).not.toContain('¹')
    expect(beta.getByText('$4.00 at API prices').textContent).not.toContain('¹')
  })

  it("marks the strip's agents but not its tokens, cost or sessions when subagents went uncounted", async () => {
    renderOverview({ totals: withPartial('uncountedSubagents') })
    await totalsLoaded()

    const strip = within(within(main()).getByRole('list', { name: 'Totals, last 7 days' }))

    expect(strip.getByText('2M').textContent).not.toContain('¹')
    expect(strip.getByText('11').textContent).toContain('¹')
    expect(strip.getByText('6').textContent).not.toContain('¹')
    expect(strip.getByText('$16.50 at API prices').textContent).not.toContain('¹')
    expect(main().textContent).toContain(
      "¹ Partial: Some sessions have a subagents folder that couldn't be read, so their subagents are missing from the agent count."
    )
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
    const thirtyDays = gate()
    renderOverview({
      totals: (dirName, window) =>
        window === '30d' && dirName === BETA ? thirtyDays.reply : normal(dirName)
    })
    await totalsLoaded()

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))

    expect(within(await findCard('beta-app')).getByText('500K tokens')).toBeTruthy()
    expect(within(main()).queryByText('Loading')).toBeNull()
    act(() => {
      thirtyDays.release(ok({ tokens: 900_000 }))
    })
    expect(await within(await findCard('beta-app')).findByText('900K tokens')).toBeTruthy()
  })
})

describe('OverviewView while a window loads', () => {
  /** Renders the overview on 7 days, then switches to 30 days with beta-app's totals held back. */
  async function holdThirtyDays(): Promise<(reply: TotalsReply) => void> {
    const thirtyDays = gate()
    renderOverview({
      totals: (dirName, window) =>
        window === '30d' && dirName === BETA ? thirtyDays.reply : normal(dirName)
    })
    await totalsLoaded()
    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))
    return thirtyDays.release
  }

  it("names the strip as updating until the new window's figures arrive", async () => {
    const release = await holdThirtyDays()

    expect(within(stripArea('Totals, last 30 days, updating')).getByText('Updating')).toBeTruthy()
    act(() => {
      release(ok({ tokens: 900_000 }))
    })
    await within(main()).findByRole('list', { name: 'Totals, last 30 days' })
    expect(within(stripArea('Totals, last 30 days')).queryByText('Updating')).toBeNull()
  })

  it("names a sidebar figure as updating, not as the new window's, until it arrives", async () => {
    const release = await holdThirtyDays()
    const sidebar = within(await findSidebar())

    const row = sidebar.getByRole('button', { name: 'beta-app 500K tokens, updating' })
    expect(row.textContent).toContain('500K…')
    act(() => {
      release(ok({ tokens: 900_000 }))
    })
    expect(
      await sidebar.findByRole('button', { name: 'beta-app 900K tokens, last 30 days' })
    ).toBeTruthy()
  })

  it('tells assistive technology which cards still show the other window', async () => {
    const release = await holdThirtyDays()

    expect(within(await findCard('beta-app')).getByText('Updating')).toBeTruthy()
    expect(within(await findCard('acme-web')).queryByText('Updating')).toBeNull()
    act(() => {
      release(ok({ tokens: 900_000 }))
    })
    await waitFor(() => {
      expect(within(main()).queryByText('Updating')).toBeNull()
    })
  })

  it('marks the cards busy until the new window has arrived', async () => {
    const release = await holdThirtyDays()
    const cards = (await findCard('beta-app')).closest('ul')

    expect(cards?.getAttribute('aria-busy')).toBe('true')
    act(() => {
      release(ok({ tokens: 900_000 }))
    })
    await waitFor(() => {
      expect(cards?.getAttribute('aria-busy')).toBe('false')
    })
  })

  it('marks the cards busy while the first totals load', async () => {
    renderOverview({ totals: never })

    expect((await findCard('beta-app')).closest('ul')?.getAttribute('aria-busy')).toBe('true')
  })

  it("holds the empty message back until the new window's totals arrive", async () => {
    renderOverview({
      totals: (_dirName, window) => (window === '30d' ? never() : Promise.resolve(ok({})))
    })
    expect(await within(main()).findByText('No activity in this window')).toBeTruthy()

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))

    expect(within(main()).queryByText('No activity in this window')).toBeNull()
  })
})

describe('OverviewView announcements', () => {
  it('stays quiet while folders arrive, then says once that the totals are in', async () => {
    const beta = gate()
    renderOverview({ totals: (dirName) => (dirName === BETA ? beta.reply : normal(dirName)) })
    await within(main()).findByText('1.5M tokens')
    const region = statusRegion()

    expect(region.textContent).toBe('')
    act(() => {
      beta.release(ok(TOTALS[BETA] ?? {}))
    })

    await waitFor(() => {
      expect(region.textContent).toBe('Totals for the last 7 days updated.')
    })
  })

  it("says the new window's totals are in only once they have all arrived", async () => {
    const thirtyDays = gate()
    renderOverview({
      totals: (dirName, window) =>
        window === '30d' && dirName === BETA ? thirtyDays.reply : normal(dirName)
    })
    await totalsLoaded()
    const region = statusRegion()
    await waitFor(() => {
      expect(region.textContent).toBe('Totals for the last 7 days updated.')
    })

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))
    expect(region.textContent).not.toContain('30 days')
    act(() => {
      thirtyDays.release(ok({ tokens: 900_000 }))
    })

    await waitFor(() => {
      expect(region.textContent).toBe('Totals for the last 30 days updated.')
    })
  })

  it('says the new window is in when its figures were already cached', async () => {
    renderOverview()
    await totalsLoaded()
    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))
    await waitFor(() => {
      expect(statusRegion().textContent).toBe('Totals for the last 30 days updated.')
    })

    await userEvent.click(within(main()).getByRole('radio', { name: '7 days' }))

    await waitFor(() => {
      expect(statusRegion().textContent).toBe('Totals for the last 7 days updated.')
    })
  })

  it('has one status region for the totals and the tokens per day together', async () => {
    renderOverview()
    await within(main()).findByRole('img', { name: /tokens/i })

    expect(within(overviewView()).getAllByRole('status')).toHaveLength(1)
  })

  it('waits for the tokens per day too before it says the totals are in', async () => {
    const usage = gate<IpcResult<ProjectDailyUsageDto>>()
    renderOverview({ dailyUsage: () => usage.reply })
    await totalsLoaded()
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(statusRegion().textContent).toBe('')

    act(() => {
      usage.release({ ok: true, value: testDailyUsage({ '2026-03-10': { a: 1 } }) })
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe('Totals for the last 7 days updated.')
    })
  })

  it('holds back the new window’s announcement until its tokens per day arrive', async () => {
    const thirtyDays = gate<IpcResult<ProjectDailyUsageDto>>()
    renderOverview({
      dailyUsage: (dirName, window) =>
        window === '30d' ? thirtyDays.reply : quietUsage(dirName, window)
    })
    await waitFor(() => {
      expect(statusRegion().textContent).toBe('Totals for the last 7 days updated.')
    })

    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))
    await waitFor(() => {
      expect(within(main()).getByRole('list', { name: /^Totals, last 30 days/ })).toBeTruthy()
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(statusRegion().textContent).not.toContain('30 days')
    act(() => {
      thirtyDays.release({ ok: true, value: testDailyUsage({ '2026-03-10': {} }) })
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe('Totals for the last 30 days updated.')
    })
  })

  it('does not announce again when midnight passes and the day’s tokens per day load', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 10, 23, 59))
    let afterMidnight = false
    const nextDay = gate<IpcResult<ProjectDailyUsageDto>>()
    renderOverview({
      dailyUsage: (dirName, window) => (afterMidnight ? nextDay.reply : quietUsage(dirName, window))
    })
    await screen.findByRole('heading', { level: 1, name: 'All projects' })
    const region = statusRegion()
    const announced: string[] = []
    new MutationObserver(() => {
      if (region.textContent !== '') announced.push(region.textContent ?? '')
    }).observe(region, { childList: true, characterData: true, subtree: true })
    await waitFor(() => {
      expect(region.textContent).toBe('Totals for the last 7 days updated.')
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const before = announced.length

    afterMidnight = true
    vi.setSystemTime(new Date(2026, 2, 11, 0, 1))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await within(main()).findByText('Updating')
    act(() => {
      nextDay.release({ ok: true, value: testDailyUsage({ '2026-03-11': {} }) })
    })
    await waitFor(() => {
      expect(within(main()).queryByText('Updating')).toBeNull()
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(announced.length).toBe(before)
    vi.useRealTimers()
  })

  it('does not announce again at midnight, using the 7 day figures as the stand-in, after the 30 day window was shown that day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 10, 23, 59))
    let afterMidnight = false
    const nextDay = gate<IpcResult<ProjectDailyUsageDto>>()
    renderOverview({
      dailyUsage: (dirName, window) => (afterMidnight ? nextDay.reply : quietUsage(dirName, window))
    })
    await screen.findByRole('heading', { level: 1, name: 'All projects' })
    const region = statusRegion()
    const announced: string[] = []
    new MutationObserver(() => {
      if (region.textContent !== '') announced.push(region.textContent ?? '')
    }).observe(region, { childList: true, characterData: true, subtree: true })
    await waitFor(() => {
      expect(region.textContent).toBe('Totals for the last 7 days updated.')
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    // The 30 day window was shown and the 7 day window chosen again, so the 30 day figures are the newer.
    vi.setSystemTime(new Date(2026, 2, 10, 23, 59, 30))
    await userEvent.click(within(main()).getByRole('radio', { name: '30 days' }))
    await waitFor(() => {
      expect(region.textContent).toBe('Totals for the last 30 days updated.')
    })
    await userEvent.click(within(main()).getByRole('radio', { name: '7 days' }))
    await waitFor(() => {
      expect(within(main()).getByRole('list', { name: /^Totals, last 7 days/ })).toBeTruthy()
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const before = announced.length

    afterMidnight = true
    vi.setSystemTime(new Date(2026, 2, 11, 0, 1))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await within(main()).findByText('Updating')
    act(() => {
      nextDay.release({ ok: true, value: testDailyUsage({ '2026-03-11': {} }) })
    })
    await waitFor(() => {
      expect(within(main()).queryByText('Updating')).toBeNull()
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(announced.length).toBe(before)
    vi.useRealTimers()
  })

  it('adds that tokens per day could not be loaded', async () => {
    renderOverview({
      dailyUsage: () => Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe(
        "Totals for the last 7 days updated. Couldn't load tokens per day."
      )
    })
  })

  it('adds that tokens per day may be low, when they are partial', async () => {
    renderOverview({
      dailyUsage: () =>
        Promise.resolve({
          ok: true,
          value: testDailyUsage({ '2026-03-10': { a: 1 } }, { skippedLines: 1 })
        })
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe(
        'Totals for the last 7 days updated. Tokens per day may be low, see the note under the chart.'
      )
    })
  })

  it('joins the totals being partial and the tokens per day being partial in one message', async () => {
    renderOverview({
      totals: withPartial('unreadable'),
      dailyUsage: () =>
        Promise.resolve({
          ok: true,
          value: testDailyUsage({ '2026-03-10': { a: 1 } }, { skippedLines: 1 })
        })
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe(
        'Totals for the last 7 days updated. Some may be low, see the note below. Tokens per day may be low, see the note under the chart.'
      )
    })
  })

  it('does not wait for tokens per day when the window is empty, since the section is not shown', async () => {
    renderOverview({
      totals: () => Promise.resolve(ok({})),
      dailyUsage: () => new Promise(() => undefined)
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toContain('No activity in this window')
    })
    expect(statusRegion().textContent).not.toContain('tokens per day')
  })

  it('says nothing about tokens per day for an empty window, even when they could not be loaded', async () => {
    renderOverview({
      totals: () => Promise.resolve(ok({})),
      dailyUsage: () => Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toContain('No activity in this window')
    })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(statusRegion().textContent).not.toContain('tokens per day')
  })

  it('says there is no activity when the window comes back empty', async () => {
    renderOverview({ totals: () => Promise.resolve(ok({})) })
    await within(main()).findByText('No activity in this window')

    await waitFor(() => {
      expect(statusRegion().textContent).toContain('No activity in this window')
    })
    expect(statusRegion().textContent).not.toContain('updated')
  })

  it("says the totals couldn't be loaded when every project failed", async () => {
    renderOverview({ totals: () => Promise.resolve(failed) })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe("Couldn't load the totals for the last 7 days.")
    })
  })

  it('says the totals may be low when some projects failed', async () => {
    renderOverview({
      totals: (dirName) => (dirName === BETA ? Promise.resolve(failed) : normal(dirName))
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe(MAY_BE_LOW)
    })
  })

  it("says the totals may be low when a session couldn't be read", async () => {
    renderOverview({ totals: withPartial('unreadable') })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe(MAY_BE_LOW)
    })
  })

  it('says the totals are in when every project failed and then they recover', async () => {
    let failing = true
    const client = createTestQueryClient()
    renderOverview({
      client,
      totals: (dirName) => (failing ? Promise.resolve(failed) : normal(dirName))
    })
    await waitFor(() => {
      expect(statusRegion().textContent).toBe("Couldn't load the totals for the last 7 days.")
    })

    failing = false
    await refetchAndSettle(client, ['projectTotals'])

    await waitFor(() => {
      expect(statusRegion().textContent).toBe('Totals for the last 7 days updated.')
    })
  })

  it('says nothing while a refresh is under way, or once it leaves the outcome as it was', async () => {
    const client = createTestQueryClient()
    const refresh = gate()
    let refreshing = false
    renderOverview({
      client,
      totals: (dirName) => (refreshing ? refresh.reply : normal(dirName))
    })
    await totalsLoaded()
    act(() => {
      useNavigationStore.getState().showSessions()
    })
    act(() => {
      useNavigationStore.getState().showOverview()
    })
    await totalsLoaded()
    expect(statusRegion().textContent).toBe('')

    refreshing = true
    await act(async () => {
      void client.invalidateQueries({ queryKey: ['projectTotals'] })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(statusRegion().textContent).toBe('')
    act(() => {
      refresh.release(ok({ tokens: 1, sessions: 1, agents: 1 }))
    })
    await within(await findCard('beta-app')).findByText('1 token')

    expect(statusRegion().textContent).toBe('')
  })

  it('says nothing when the overview opens with its totals already in', async () => {
    renderOverview()
    await totalsLoaded()
    act(() => {
      useNavigationStore.getState().showSessions()
    })
    act(() => {
      useNavigationStore.getState().showOverview()
    })
    await totalsLoaded()

    expect(statusRegion().textContent).toBe('')
  })
})

describe('OverviewView empty window', () => {
  it("does not call the window empty when sessions in it couldn't be read", async () => {
    renderOverview({
      totals: () => Promise.resolve(ok({ partial: { ...testTotals().partial, unreadable: 1 } }))
    })

    await waitFor(() => {
      expect(statusRegion().textContent).toBe(MAY_BE_LOW)
    })
    expect(main().textContent).toContain("Some sessions couldn't be read.")
    expect(within(main()).queryByText('No activity in this window')).toBeNull()
  })

  it('offers 30 days to look further back from the 7 day window', async () => {
    renderOverview({ totals: () => Promise.resolve(ok({})) })

    expect(
      await within(main()).findByText(
        'No agent ran in the last 7 days. Choose 30 days to look further back.'
      )
    ).toBeTruthy()
  })

  it('does not offer 30 days when the 30 day window is the one that is empty', async () => {
    useTotalsWindowStore.setState({ window: '30d' })
    renderOverview({ totals: () => Promise.resolve(ok({})) })

    expect(await within(main()).findByText('No agent ran in the last 30 days.')).toBeTruthy()
    expect(main().textContent).not.toContain('Choose 30 days')
  })
})

describe('OverviewView tokens per day', () => {
  const usage: BeekeeperApi['getProjectDailyUsage'] = () =>
    Promise.resolve({ ok: true, value: testDailyUsage({ '2026-03-10': { 'claude-opus-5': 5 } }) })
  const section = (): HTMLElement =>
    within(main()).getByRole('region', { name: 'Tokens per day, by model' })

  it('shows the section between the totals and the project cards', async () => {
    renderOverview({ dailyUsage: usage })

    const heading = await within(main()).findByRole('heading', {
      level: 2,
      name: 'Tokens per day, by model'
    })
    const strip = within(main()).getByRole('list', { name: /^Totals/ })
    const cards = within(main()).getAllByRole('list').at(-1)
    expect(strip.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      heading.compareDocumentPosition(cards as Node) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(await within(section()).findByRole('img', { name: /15 in all/ })).toBeTruthy()
  })

  it('is absent when nothing ran in the window', async () => {
    renderOverview({ totals: () => Promise.resolve(ok({})), dailyUsage: usage })

    expect(await within(main()).findByText('No activity in this window')).toBeTruthy()
    expect(within(main()).queryByRole('region', { name: 'Tokens per day, by model' })).toBeNull()
  })

  it('is absent when there are no projects', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    render(<OverviewView />, { wrapper: createQueryWrapper() })

    expect(await screen.findByRole('heading', { level: 1, name: 'All projects' })).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('region', { name: 'Tokens per day, by model' })).toBeNull()
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

  it('marks a row whose total may be low with its own sign and words, since the footnote is only on the overview', async () => {
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
      name: 'beta-app 500K tokens, last 7 days, may be low'
    })

    expect(row.textContent).toContain('~500K')
    expect(row.textContent).not.toContain('¹')
  })

  it('explains the ~ under the list while a figure carries it', async () => {
    renderOverview({ totals: withPartial('withoutTokens') })
    await totalsLoaded()

    expect(await within(await findSidebar()).findByText('~ Total may be low')).toBeTruthy()
  })

  it('shows no ~ note when every figure is complete', async () => {
    renderOverview()
    await totalsLoaded()
    const sidebar = within(await findSidebar())
    await sidebar.findByRole('button', { name: 'beta-app 500K tokens, last 7 days' })

    expect(sidebar.queryByText('~ Total may be low')).toBeNull()
  })

  it('leaves a row unmarked when only its cost may be low, since the row shows tokens', async () => {
    renderOverview({ totals: withPartial('withoutCost') })
    await totalsLoaded()

    const row = await within(await findSidebar()).findByRole('button', {
      name: 'beta-app 500K tokens, last 7 days'
    })

    expect(row.textContent).not.toContain('~')
  })

  it("doesn't mark a row's tokens because subagents went uncounted", async () => {
    renderOverview({ totals: withPartial('uncountedSubagents') })
    await totalsLoaded()

    const row = await within(await findSidebar()).findByRole('button', {
      name: 'beta-app 500K tokens, last 7 days'
    })

    expect(row.textContent).not.toContain('~')
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
