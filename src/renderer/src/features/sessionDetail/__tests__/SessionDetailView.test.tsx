import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
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
import { testDetail, testReport, testTokenGroup } from '../testSessionDetail'

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
  vi.useRealTimers()
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

  it('renders from the detail alone, with a neutral name and the short id, when the session is not listed', async () => {
    openSession(testRef(9, DIR))

    expect(await screen.findByRole('heading', { level: 1, name: 'Session' })).toBeTruthy()
    expect(screen.queryByText('Untitled session')).toBeNull()
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
    expect(screen.getByText('partial, see the note below')).toBeTruthy()
    expect(screen.queryByText('partial, see the note below the list')).toBeNull()
  })

  it('words a missing teammate without pointing at a list the page does not have', async () => {
    const team = testLeadTeam([testRef(2, DIR)], testUsage({ missingTeammates: 1 }))
    const partial = testSession(1, { projectDirName: DIR, title: 'Partial', totalTokens: 5, team })
    openSession(testRef(1, DIR), { sessions: [partial] })
    await screen.findByRole('heading', { level: 1, name: 'Partial' })

    expect(screen.getByText(/Some teammates the lead spawned weren't found/)).toBeTruthy()
    expect(screen.queryByText(/aren't in this list/)).toBeNull()
  })

  it('explains that a teammate chip’s subagents are not in the total, but says nothing else is partial', async () => {
    const chipPartial = testSession(2, {
      projectDirName: DIR,
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(1, DIR)),
      transcriptTokens: 400,
      subagentCount: 1
    })
    const recorded = testDetail({
      lead: testReport({ tokenGroups: [testTokenGroup({ input: 10 })] })
    })
    openSession(testRef(1, DIR), {
      sessions: [lead, chipPartial],
      detail: { ok: true, value: recorded }
    })
    await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })

    expect(screen.getByText(/subagents aren.t loaded/)).toBeTruthy()
    expect(screen.queryByText(/leave out its subagents/)).toBeNull()
    expect(screen.queryByText(/transcript lines couldn't be read/)).toBeNull()
  })

  it('names the teammate, not its lead, when the session is a teammate’s own', async () => {
    openSession(testRef(2, DIR))

    expect(await screen.findByRole('heading', { level: 1, name: 'writer (code)' })).toBeTruthy()
  })
})

describe('SessionDetailView moving to another session', () => {
  it('announces the next session’s load even after the last one’s announcement has cleared', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    openSession(testRef(2, DIR))
    await screen.findByText('writer (code) loaded')
    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS)
    })
    expect(screen.queryByText('writer (code) loaded')).toBeNull()

    await userEvent.click(within(await breadcrumb()).getByRole('button', { name: 'Lead session' }))

    expect(await screen.findByText('Refactor parser loaded')).toBeTruthy()
  })
})

describe('SessionDetailView graph', () => {
  it('shows the agent graph under the header, selecting the lead', async () => {
    openSession(testRef(1, DIR))

    const region = within(await screen.findByRole('region', { name: 'Agent graph' }))

    expect(region.getByRole('button', { name: /^Lead, lead/ }).getAttribute('aria-current')).toBe(
      'true'
    )
  })

  it('shows no graph while the detail loads', async () => {
    openSession(testRef(1, DIR), {
      detail: new Promise<IpcResult<SessionDetailDto>>(() => undefined)
    })
    await screen.findByRole('heading', { level: 1, name: 'Loading session' })

    expect(screen.queryByRole('region', { name: 'Agent graph' })).toBeNull()
  })

  it('shows no graph when the detail fails', async () => {
    openSession(testRef(1, DIR), { detail: { ok: false, error: { code: 'unreadable' } } })
    await screen.findByRole('alert')

    expect(screen.queryByRole('region', { name: 'Agent graph' })).toBeNull()
  })
})

describe('SessionDetailView breadcrumb', () => {
  it('runs from the project through Sessions to the session, which is the current page', async () => {
    openSession(testRef(1, DIR))
    await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })

    const trail = within(await breadcrumb())

    expect(trail.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      DIR,
      'Sessions',
      'Refactor parser'
    ])
    expect(trail.getByText('Refactor parser').getAttribute('aria-current')).toBe('page')
  })

  it('goes back to the sessions list from Sessions', async () => {
    openSession(testRef(1, DIR))

    await userEvent.click(within(await breadcrumb()).getByRole('button', { name: 'Sessions' }))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null
    })
  })

  it('shows the project as plain text, since Sessions is the step that goes to its list', async () => {
    openSession(testRef(1, DIR))

    const trail = within(await breadcrumb())

    expect(trail.getByText(DIR)).toBeTruthy()
    expect(trail.queryByRole('button', { name: DIR })).toBeNull()
  })

  it('links a teammate’s own session back to its lead', async () => {
    openSession(testRef(2, DIR))
    await screen.findByRole('heading', { level: 1, name: 'writer (code)' })

    await userEvent.click(within(await breadcrumb()).getByRole('button', { name: 'Lead session' }))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: testRef(1, DIR),
      selectedAgent: null
    })
  })

  it('has no lead link on a lead’s own session', async () => {
    openSession(testRef(1, DIR))
    await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })

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
    await screen.findByRole('heading', { level: 1, name: 'Session' })

    expect(api.listSessions).toHaveBeenCalled()
    expect(api.listSessions.mock.calls.every(([folder]) => folder === DIR)).toBe(true)
  })
})

describe('SessionDetailView states', () => {
  it('says it is loading while the detail loads', async () => {
    openSession(testRef(1, DIR), { detail: new Promise(() => undefined) })

    const heading = await screen.findByRole('heading', { level: 1, name: 'Loading session' })
    expect(heading.closest('[role="status"]')).not.toBeNull()
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

  it.each([
    ['loading', { detail: new Promise<IpcResult<SessionDetailDto>>(() => undefined) }],
    ['a missing session', { detail: { ok: false, error: { code: 'not-found' } } }],
    ['an unreadable session', { detail: { ok: false, error: { code: 'unreadable' } } }],
    ['any other failure', { detail: { ok: false, error: { code: 'invalid-request' } } }]
  ] as const)(
    'keeps the breadcrumb, with a way back to Sessions, while %s',
    async (_state, options) => {
      openSession(testRef(1, DIR), options)

      const trail = within(await breadcrumb())
      await userEvent.click(trail.getByRole('button', { name: 'Sessions' }))

      expect(useNavigationStore.getState()).toMatchObject({
        view: 'sessions',
        selectedSessionRef: null
      })
    }
  )

  it('names the session in the breadcrumb of a failure, by the list’s title', async () => {
    openSession(testRef(1, DIR), { detail: { ok: false, error: { code: 'unreadable' } } })

    const trail = within(await breadcrumb())

    expect((await trail.findByText('Refactor parser')).getAttribute('aria-current')).toBe('page')
  })

  it('announces a failure as an alert', async () => {
    openSession(testRef(1, DIR), { detail: { ok: false, error: { code: 'unreadable' } } })

    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
