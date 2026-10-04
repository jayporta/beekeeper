import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { installBeekeeperApi, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { SessionDetailView } from '../SessionDetailView'
import { testDetail } from '../testSessionDetail'

const DIR = '-Users-a-repo'
const OTHER = '-Users-a-other'
const EARLIEST = Date.parse('2026-01-15T11:00:00Z')

const lead = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  earliestMs: EARLIEST,
  latestMs: EARLIEST + 85 * 60_000,
  subagentCount: 3,
  team: testLeadTeam([testRef(2, DIR)], testUsage({ teamTokens: 3_100_000, teamUSD: 13.23 }))
})
const mate = testSession(2, {
  projectDirName: DIR,
  role: testAgentRole('writer', 'code'),
  team: testTeammateTeam(testRef(1, DIR))
})
const SESSIONS = [lead, mate]

const GOOD: IpcResult<SessionDetailDto> = { ok: true, value: testDetail() }

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

/** Opens `ref` with the sessions list and detail stubbed. */
function openSession(
  ref: { projectDirName: string; sessionId: string },
  options: {
    sessions?: readonly SessionListItemDto[]
    detail?: IpcResult<SessionDetailDto> | Promise<IpcResult<SessionDetailDto>>
  } = {}
): TestBeekeeperApi {
  const { sessions = SESSIONS, detail = GOOD } = options
  const api = installBeekeeperApi({
    listSessions: () => Promise.resolve({ ok: true, value: sessions }),
    getSession: () => Promise.resolve(detail)
  })
  useNavigationStore.getState().showSession(ref)
  renderApp()
  return api
}

const breadcrumb = async (): Promise<HTMLElement> =>
  screen.findByRole('navigation', { name: 'Breadcrumb' })

describe('SessionDetailView header', () => {
  it('names the page and the main landmark by the session title', async () => {
    openSession(testRef(1, DIR))

    expect(await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })).toBeTruthy()
    expect(screen.getByRole('main', { name: 'Refactor parser' })).toBeTruthy()
  })

  it('shows the start, duration, team, agents and totals beneath the title', async () => {
    openSession(testRef(1, DIR))
    await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })

    const line = screen.getByText(/1h 25m/)

    expect(line.textContent).toContain('team team')
    expect(line.textContent).toContain('1 teammate, 3 subagents')
    expect(line.textContent).toContain('3.1M tokens')
    expect(line.textContent).toContain('$13.23 at API prices')
  })

  it('shows the short id beside the placeholder title of an untitled session', async () => {
    const untitled = testSession(5, { projectDirName: DIR })
    openSession(testRef(5, DIR), { sessions: [untitled] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Untitled session' })).toBeTruthy()
    expect(screen.getByText('00000005')).toBeTruthy()
  })

  it('renders from the detail alone, titled by the short id, when the session is not listed', async () => {
    openSession(testRef(9, DIR))

    expect(await screen.findByRole('heading', { level: 1, name: 'Untitled session' })).toBeTruthy()
    expect(screen.getByText('00000009')).toBeTruthy()
  })

  it('explains a partial total in a footnote under the line', async () => {
    const partial = testSession(1, {
      projectDirName: DIR,
      title: 'Partial',
      totalTokens: 5,
      skippedLines: 2
    })
    openSession(testRef(1, DIR), { sessions: [partial] })
    await screen.findByRole('heading', { level: 1, name: 'Partial' })

    expect(screen.getByText(/Some transcript lines couldn't be read/)).toBeTruthy()
    expect(screen.getByText('partial, see the note below the list')).toBeTruthy()
  })

  it('names the teammate, not its lead, when the session is a teammate’s own', async () => {
    openSession(testRef(2, DIR))

    expect(await screen.findByRole('heading', { level: 1, name: 'writer (code)' })).toBeTruthy()
  })
})

describe('SessionDetailView breadcrumb', () => {
  it('runs from the project through Sessions to the session, which is the current page', async () => {
    openSession(testRef(1, DIR))

    const trail = within(await breadcrumb())

    expect(trail.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      DIR,
      'Sessions',
      'Refactor parser'
    ])
    expect(trail.getByText('Refactor parser').getAttribute('aria-current')).toBe('page')
  })

  it.each([DIR, 'Sessions'])('goes back to the sessions list from %s', async (name) => {
    openSession(testRef(1, DIR))

    await userEvent.click(within(await breadcrumb()).getByRole('button', { name }))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null
    })
  })

  it('links a teammate’s own session back to its lead', async () => {
    openSession(testRef(2, DIR))

    await userEvent.click(within(await breadcrumb()).getByRole('button', { name: 'Lead session' }))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: testRef(1, DIR),
      selectedAgent: null
    })
  })

  it('has no lead link on a lead’s own session', async () => {
    openSession(testRef(1, DIR))

    expect(within(await breadcrumb()).queryByRole('button', { name: 'Lead session' })).toBeNull()
  })

  it('never lists the sessions of a second folder for a teammate whose lead lives in one', async () => {
    const away = testSession(2, {
      projectDirName: DIR,
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(1, OTHER))
    })

    const api = openSession(testRef(2, DIR), { sessions: [away] })
    await screen.findByRole('heading', { level: 1, name: 'writer (code)' })

    expect(api.listSessions).toHaveBeenCalled()
    expect(api.listSessions.mock.calls.every(([folder]) => folder === DIR)).toBe(true)
  })
})

describe('SessionDetailView without a selected project', () => {
  it('renders nothing and lists no sessions while the projects are unavailable', () => {
    const api = installBeekeeperApi({
      listProjects: () => new Promise(() => undefined),
      listSessions: () => Promise.resolve({ ok: true, value: SESSIONS })
    })
    useNavigationStore.getState().showSession(testRef(1, DIR))

    const { container } = render(<SessionDetailView />, { wrapper: createQueryWrapper() })

    expect(container.textContent).toBe('')
    expect(api.listSessions).not.toHaveBeenCalled()
  })
})

describe('SessionDetailView in another folder', () => {
  it('reads only the selected project’s list for a session that lives in another folder', async () => {
    const api = openSession(testRef(1, OTHER))
    await screen.findByRole('heading', { level: 1, name: 'Untitled session' })

    expect(api.listSessions).toHaveBeenCalled()
    expect(api.listSessions.mock.calls.every(([folder]) => folder === DIR)).toBe(true)
  })
})

describe('SessionDetailView states', () => {
  it('says it is loading while the detail loads', async () => {
    openSession(testRef(1, DIR), { detail: new Promise(() => undefined) })

    expect(await screen.findByRole('heading', { level: 1, name: 'Loading session' })).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('offers a way back to the sessions list when the session is gone', async () => {
    openSession(testRef(1, DIR), { detail: { ok: false, error: { code: 'not-found' } } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Session not found' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Back to sessions' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('says the session cannot be read, with a retry, when its files are unreadable', async () => {
    const api = openSession(testRef(1, DIR), {
      detail: { ok: false, error: { code: 'unreadable' } }
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: "Can't read this session" })
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(api.getSession.mock.calls.length).toBeGreaterThan(1)
    })
  })

  it('says something went wrong, with a retry, for any other failure', async () => {
    openSession(testRef(1, DIR), { detail: { ok: false, error: { code: 'invalid-request' } } })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('announces a failure as an alert', async () => {
    openSession(testRef(1, DIR), { detail: { ok: false, error: { code: 'unreadable' } } })

    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
