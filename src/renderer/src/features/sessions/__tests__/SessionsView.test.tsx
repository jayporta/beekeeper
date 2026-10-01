import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { SessionsContent } from '../SessionsContent'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import {
  testAgentRole,
  testCost,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'

const DIR = '-Users-a-repo'
const ok = (
  value: readonly SessionListItemDto[]
): Promise<IpcResult<readonly SessionListItemDto[]>> => Promise.resolve({ ok: true, value })

const lead = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  latestMs: Date.parse('2026-01-15T12:00:00Z'),
  earliestMs: Date.parse('2026-01-15T11:00:00Z'),
  model: 'claude-opus-5',
  team: testLeadTeam(
    [testRef(2, DIR), testRef(3, '-Users-a-other')],
    testCost({ missingTeammates: 1 })
  )
})
const mateA = testSession(2, {
  projectDirName: DIR,
  role: testAgentRole('reviewer', 'code'),
  team: testTeammateTeam(testRef(1, DIR), true)
})
const mateB = testSession(3, {
  projectDirName: '-Users-a-other',
  role: testAgentRole('writer', 'code'),
  team: testTeammateTeam(testRef(1, DIR))
})
const solo = testSession(4, { projectDirName: DIR, latestMs: 1, costUSD: 0.004 })
const SESSIONS = [lead, mateA, mateB, solo]

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '', expanded: new Set() })
})

afterEach(resetPersistedState)

function showSessions(sessions: readonly SessionListItemDto[] = SESSIONS): void {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
    listSessions: () => ok(sessions)
  })
  renderApp()
}

describe('SessionsView table', () => {
  it('renders a table named by the heading with the seven columns', async () => {
    showSessions()

    const table = await screen.findByRole('table', { name: 'Sessions' })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual([
      'Session',
      'Last active',
      'Duration',
      'Model',
      'Agents',
      'Lead cost',
      'Team cost'
    ])
  })

  it('shows only top-level rows at first: leads and sessions with no lead', async () => {
    showSessions()

    await screen.findByRole('table')
    expect(screen.getByRole('rowheader', { name: /^Refactor parser/ })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /Untitled session/ })).toBeTruthy()
    expect(screen.queryByRole('rowheader', { name: /reviewer/ })).toBeNull()
  })

  it('shows the lead cells: duration, model, agents, costs and partial marker', async () => {
    showSessions()

    const row = (await screen.findByRole('rowheader', { name: /^Refactor parser/ })).closest('tr')
    const cells = within(row as HTMLElement).getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual([
      expect.stringMatching(/2026/),
      '1h',
      'claude-opus-5',
      '2 teammates',
      '$1.00',
      '$3.00partial'
    ])
  })

  it('marks a missing value as not recorded and a tiny cost as under a cent', async () => {
    showSessions()

    const row = (await screen.findByRole('rowheader', { name: /Untitled session/ })).closest('tr')
    const text = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(text).toContain('<$0.01')
    expect(text).toContain('-not recorded')
  })

  it('names a row header by the session, and the lead for a nested row, not its button or notes', async () => {
    showSessions()
    await userEvent.click(
      await screen.findByRole('button', { name: '2 teammates of Refactor parser' })
    )

    expect(screen.getByRole('rowheader', { name: 'Refactor parser' })).toBeTruthy()
    expect(
      screen.getByRole('rowheader', { name: 'reviewer (code) teammate of Refactor parser' })
    ).toBeTruthy()
  })

  it('includes the short id in the name of a row that has no title', async () => {
    showSessions()

    const header = await screen.findByRole('rowheader', { name: /^Untitled session / })

    expect(header.textContent).toContain('Untitled session')
  })

  it('marks a team cost that does not apply to a teammate as not applicable, not as not recorded', async () => {
    showSessions()
    await userEvent.click(
      await screen.findByRole('button', { name: '2 teammates of Refactor parser' })
    )

    const row = screen.getByRole('rowheader', { name: /^reviewer \(code\)/ }).closest('tr')
    const cells = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((c) => c.textContent)

    // Cells: last active, duration, model, agents, lead cost, team cost.
    expect(cells[5]).toBe('-not applicable')
    expect(cells[4]).toBe('-not recorded')
  })

  it('expands a lead teammates with a disclosure button and collapses them again', async () => {
    showSessions()
    const button = await screen.findByRole('button', { name: '2 teammates of Refactor parser' })
    expect(button.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(button)

    expect(button.getAttribute('aria-expanded')).toBe('true')
    const nested = screen.getByRole('rowheader', { name: /reviewer \(code\)/ })
    expect(nested.textContent).toContain('stopped')
    expect(screen.getByRole('rowheader', { name: /writer \(code\)/ }).textContent).toContain(
      'in -Users-a-other'
    )

    await userEvent.click(button)

    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('rowheader', { name: /reviewer/ })).toBeNull()
  })

  it('can be operated from the keyboard', async () => {
    showSessions()
    const button = await screen.findByRole('button', { name: '2 teammates of Refactor parser' })

    button.focus()
    await userEvent.keyboard('{Enter}')

    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('points the disclosure button at the teammate rows it shows', async () => {
    showSessions()
    const button = await screen.findByRole('button', { name: '2 teammates of Refactor parser' })
    await userEvent.click(button)

    const ids = (button.getAttribute('aria-controls') ?? '').split(' ')
    expect(ids).toHaveLength(2)
    for (const id of ids) expect(document.getElementById(id)).toBeTruthy()
  })
})

describe('SessionsView search', () => {
  it('filters rows by name and shows a matching teammate under its lead without expanding', async () => {
    showSessions()
    await screen.findByRole('table')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'review')

    expect(screen.getByRole('rowheader', { name: /^Refactor parser/ })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /reviewer \(code\)/ })).toBeTruthy()
    expect(screen.queryByRole('rowheader', { name: /Untitled session/ })).toBeNull()
    expect(screen.queryByRole('rowheader', { name: /writer/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /teammates of/ })).toBeNull()
  })

  it('tells a screen reader that a nested row is a teammate of its lead', async () => {
    showSessions()
    await userEvent.click(
      await screen.findByRole('button', { name: '2 teammates of Refactor parser' })
    )

    expect(screen.getByRole('rowheader', { name: /reviewer \(code\)/ }).textContent).toContain(
      'teammate of Refactor parser'
    )
    expect(screen.getByRole('rowheader', { name: /^Refactor parser/ }).textContent).not.toContain(
      'teammate of'
    )
  })

  it('says so when nothing matches', async () => {
    showSessions()
    await screen.findByRole('table')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'zzz')

    expect(screen.getByRole('heading', { name: 'No matching sessions' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('SessionsView search announcements', () => {
  it('has an empty polite status region before anything is typed', async () => {
    showSessions()
    await screen.findByRole('table')

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('announces how many sessions match, and when none do', async () => {
    showSessions()
    await screen.findByRole('table')
    const search = screen.getByRole('searchbox', { name: 'Search sessions' })

    await userEvent.type(search, 'code')
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('2 sessions match')
    })

    await userEvent.clear(search)
    await userEvent.type(search, 'parser')
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('1 session matches')
    })

    await userEvent.clear(search)
    await userEvent.type(search, 'zzz')
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('No matching sessions')
    })
  })
})

describe('SessionsView search announcements across a project switch', () => {
  it('keeps one live region mounted while loading, so a match count is announced when it loads', async () => {
    useSessionsViewStore.setState({ query: 'code' })
    let resolve: (value: IpcResult<readonly SessionListItemDto[]>) => void = () => undefined
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () => new Promise((r) => (resolve = r))
    })
    renderApp()
    await screen.findByRole('heading', { name: 'Loading sessions' })
    const region = document.querySelector('p[role="status"]')

    expect(region?.textContent).toBe('')
    await act(async () => {
      resolve({ ok: true, value: SESSIONS })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(region?.textContent).toBe('2 sessions match')
    })
    expect(document.querySelector('p[role="status"]')).toBe(region)
  })
})

describe('SessionsContent with a failed background refresh', () => {
  it('keeps the loaded sessions on screen', async () => {
    let failing = false
    installBeekeeperApi({
      listSessions: () =>
        failing ? Promise.resolve({ ok: false, error: { code: 'internal' } }) : ok(SESSIONS)
    })
    const client = createTestQueryClient()
    render(<SessionsContent dirName={DIR} headingId="h" />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByRole('table')

    failing = true
    await refetchAndSettle(client, ['sessions', DIR])

    expect(client.getQueryState(['sessions', DIR])?.status).toBe('error')
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('SessionsView states', () => {
  it('announces loading', async () => {
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () => new Promise(() => undefined)
    })
    renderApp()

    const heading = await screen.findByRole('heading', { name: 'Loading sessions' })
    expect(heading.closest('[role="status"]')).toBeTruthy()
  })

  it('explains a folder with no sessions', async () => {
    showSessions([])

    expect(await screen.findByRole('heading', { name: 'No sessions in this project' })).toBeTruthy()
  })

  it('shows an error with Retry, and Retry loads the sessions', async () => {
    let calls = 0
    installBeekeeperApi({
      listSessions: () => {
        calls += 1
        // The first call and its three retries fail, so the error state shows.
        return calls <= 4
          ? Promise.resolve({ ok: false, error: { code: 'internal' } })
          : ok(SESSIONS)
      }
    })
    renderApp()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('table')).toBeTruthy()
  })

  it('moves focus to the main landmark when Retry replaces the error with loading', async () => {
    installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderApp()

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('forgets the selection and refreshes the project list when the folder is gone', async () => {
    useSelectedProjectStore.setState({ selectedDirName: DIR })
    const api = installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: false, error: { code: 'not-found' } })
    })
    renderApp()

    await waitFor(() => {
      expect(useSelectedProjectStore.getState().selectedDirName).toBeNull()
    })
    await waitFor(() => {
      expect(api.listProjects.mock.calls.length).toBeGreaterThan(1)
    })
  })
})
