import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testDetail } from '@renderer/features/sessionDetail/testSessionDetail'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { hydratePersistedStores, renderAppReady } from '@renderer/testAppReady'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../testSessionFixtures'

const DIR = '-Users-a-repo'
const OTHER = '-Users-a-other'

const lead = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  latestMs: Date.parse('2026-01-15T12:00:00Z'),
  earliestMs: Date.parse('2026-01-15T11:00:00Z'),
  model: 'claude-opus-5',
  subagentCount: 1,
  team: testLeadTeam([testRef(2, DIR), testRef(3, OTHER)], testUsage({ missingTeammates: 1 }))
})
const reviewer = testSession(2, {
  projectDirName: DIR,
  role: testAgentRole('reviewer', 'code'),
  totalTokens: 1500,
  subagentCount: 2,
  team: testTeammateTeam(testRef(1, DIR), true)
})
const writer = testSession(3, {
  projectDirName: OTHER,
  role: testAgentRole('writer', 'code'),
  totalTokens: 2500,
  team: testTeammateTeam(testRef(1, DIR))
})
const solo = testSession(4, {
  projectDirName: DIR,
  title: 'Plain session',
  latestMs: 1,
  totalTokens: 7,
  costUSD: 0.5,
  subagentCount: 2
})
const SESSIONS = [lead, reviewer, writer, solo]

beforeEach(async () => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
  await hydratePersistedStores()
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

async function showSessions(sessions: readonly SessionListItemDto[] = SESSIONS): Promise<void> {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
    listSessions: () => Promise.resolve({ ok: true, value: sessions }),
    getSession: () => Promise.resolve({ ok: true, value: testDetail() })
  })
  await renderAppReady()
}

/** The card whose title is `name`. */
async function cardOf(name: string | RegExp): Promise<HTMLElement> {
  const title = await screen.findByRole('heading', { level: 2, name })
  return title.closest('li') as HTMLElement
}

describe('session cards', () => {
  it('lists one card per lead or solo session, newest first, in a list named by the project', async () => {
    await showSessions()

    const list = await screen.findByRole('list', { name: DIR })

    expect(
      within(list)
        .getAllByRole('heading', { level: 2 })
        .map((title) => title.textContent)
    ).toEqual(['Refactor parser', 'Plain session'])
  })

  it('shows a lead with its agent count, team total, and a chip for each teammate', async () => {
    await showSessions()

    const card = await cardOf('Refactor parser')

    expect(within(card).getByText('2 teammates, 1 subagent')).toBeTruthy()
    expect(within(card).getByText('team total')).toBeTruthy()
    expect(within(card).getByText('300 tokens')).toBeTruthy()
    const chips = within(within(card).getByRole('list', { name: 'Teammates of Refactor parser' }))
    expect(
      chips.getByRole('button', { name: 'reviewer (code) stopped 2 subagents 1.5K tokens' })
    ).toBeTruthy()
    expect(
      chips.getByRole('button', { name: 'writer (code) in -Users-a-other 2.5K tokens' })
    ).toBeTruthy()
  })

  it('labels the agents cell and the duration cell for assistive technology', async () => {
    await showSessions()

    const card = await cardOf('Refactor parser')

    expect(within(card).getByText('Agents')).toBeTruthy()
    expect(within(card).getByText('Duration')).toBeTruthy()
  })

  it('shows the last active time, model, and duration of a session', async () => {
    await showSessions()

    const card = await cardOf('Refactor parser')

    expect(within(card).getByText(/2026.*claude-opus-5/)).toBeTruthy()
    expect(within(card).getByText('1h')).toBeTruthy()
    expect(within(card).getByText('Duration')).toBeTruthy()
  })

  it('shows a solo session with subagents with no chips, no team total, and "at API prices"', async () => {
    await showSessions()

    const card = await cardOf('Plain session')

    expect(within(card).getByText('2 subagents')).toBeTruthy()
    expect(within(card).getByText('$0.50 at API prices')).toBeTruthy()
    expect(within(card).queryByText('team total')).toBeNull()
    expect(within(card).queryByRole('list')).toBeNull()
  })

  it('marks a missing value as not recorded and a tiny cost as under a cent', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, title: 'Cheap', costUSD: 0.004 })])

    const card = await cardOf('Cheap')

    expect(card.textContent).toContain('-tokens not recorded')
    expect(within(card).getByText('<$0.01 at API prices')).toBeTruthy()
  })

  it("shows the transcript's tokens, marked partial, for a session that recorded none", async () => {
    await showSessions([
      testSession(5, {
        projectDirName: DIR,
        title: 'Still running',
        transcriptTokens: 1200,
        subagentCount: 2
      })
    ])

    const card = await cardOf('Still running')

    expect(within(card).getByText('1.2K tokens')).toBeTruthy()
    expect(card.textContent).not.toContain('tokens not recorded')
    expect(within(card).getByText('¹')).toBeTruthy()
  })

  it('shows a lead with no grouped teammates as a team total, without chips', async () => {
    const orphanLead = testSession(5, {
      projectDirName: DIR,
      title: 'Lost its team',
      team: testLeadTeam([], testUsage({ missingTeammates: 2 }))
    })
    await showSessions([orphanLead])

    const card = await cardOf('Lost its team')

    expect(within(card).getByText('team total')).toBeTruthy()
    expect(within(card).getByText('¹')).toBeTruthy()
    expect(within(card).queryByRole('list')).toBeNull()
  })

  it('names the true agent count when there are more agents than marks', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, title: 'Busy', subagentCount: 40 })])

    const card = await cardOf('Busy')

    expect(within(card).getByText('40 subagents')).toBeTruthy()
    expect(within(card).getByText('+29')).toBeTruthy()
  })

  it('shows a teammate whose lead is not listed as its own card, noting where the lead is', async () => {
    const stray = testSession(5, {
      projectDirName: DIR,
      role: testAgentRole('stray', 'code'),
      team: testTeammateTeam(testRef(9, OTHER))
    })
    await showSessions([stray])

    const card = await cardOf('stray (code)')

    expect(within(card).getByText(/lead in -Users-a-other/)).toBeTruthy()
  })

  it('shows an unreadable session as a placeholder card with spoken missing values, still openable', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, unreadable: true })])

    const card = await cardOf('Unreadable session')

    expect(within(card).getByText('00000005')).toBeTruthy()
    expect(card.textContent).toContain('-not recorded')
    await userEvent.click(within(card).getByRole('button', { name: 'Unreadable session' }))
    expect(useNavigationStore.getState().selectedSessionRef).toEqual(testRef(5, DIR))
  })

  it('shows a title that looks like markup literally, in the card and in the chips label', async () => {
    const hostile = '<b>x</b> &amp; {{name}} $t(common:retry)'
    const hostileLead = testSession(1, {
      projectDirName: DIR,
      title: hostile,
      team: testLeadTeam([testRef(2, DIR)])
    })
    await showSessions([hostileLead, { ...reviewer, team: testTeammateTeam(testRef(1, DIR)) }])

    const card = await cardOf(hostile)

    expect(within(card).getByRole('list', { name: `Teammates of ${hostile}` })).toBeTruthy()
  })
})

describe('session cards: legend', () => {
  it('names the kinds of mark on screen', async () => {
    await showSessions()
    await cardOf('Refactor parser')

    expect(screen.getByText('Lead')).toBeTruthy()
    expect(screen.getByText('Teammate')).toBeTruthy()
    expect(screen.getByText('Subagent')).toBeTruthy()
  })

  it('leaves out the kinds that no card on screen draws', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, title: 'On its own' })])
    await cardOf('On its own')

    expect(screen.getByText('Lead')).toBeTruthy()
    expect(screen.queryByText('Teammate')).toBeNull()
    expect(screen.queryByText('Subagent')).toBeNull()
  })
})

describe('session cards: partial figures', () => {
  it('shows no footnote when no figure is partial', async () => {
    await showSessions([solo])
    await cardOf('Plain session')

    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('shows a marker on the partial card and a footnote naming exactly the reasons on screen', async () => {
    await showSessions()

    const card = await cardOf('Refactor parser')

    expect(within(card).getByText('¹')).toBeTruthy()
    expect(within(card).getByText('partial, see the note below the list')).toBeTruthy()
    expect(
      screen.getByText("Some teammates the lead spawned aren't in this list", { exact: false })
        .textContent
    ).toBe(
      "¹ Partial: Some teammates the lead spawned aren't in this list, so a team total may be low."
    )
  })

  it('names the reasons of every card on screen, each once', async () => {
    const unreadable = testSession(5, {
      projectDirName: DIR,
      title: 'Garbled',
      totalTokens: 3,
      skippedLines: 4,
      latestMs: 2
    })
    await showSessions([lead, reviewer, writer, unreadable])
    await cardOf('Garbled')

    const note = screen.getByText(/Partial:/).textContent
    expect(note).toContain("Some transcript lines couldn't be read")
    expect(note).toContain("Some teammates the lead spawned aren't in this list")
    expect(note).not.toContain('recorded no usage')
  })

  it('says a reason that several cards share once', async () => {
    const otherLead = testSession(5, {
      projectDirName: DIR,
      title: 'Also short a teammate',
      latestMs: 2,
      team: testLeadTeam([], testUsage({ missingTeammates: 3 }))
    })
    await showSessions([lead, reviewer, writer, otherLead])
    await cardOf('Also short a teammate')

    const note = screen.getByText(/Partial:/).textContent ?? ''
    const sentence = "Some teammates the lead spawned aren't in this list"
    expect(note.split(sentence)).toHaveLength(2)
  })

  describe('for a lead that shows no figures', () => {
    const nothingRecorded = testUsage({
      leadTokens: null,
      leadUSD: null,
      teamTokens: null,
      teamUSD: null,
      sessionsWithoutTokens: 1,
      missingTeammates: 1
    })
    const emptyLead = testSession(5, {
      projectDirName: DIR,
      title: 'Empty lead',
      team: testLeadTeam([testRef(6, DIR)], nothingRecorded)
    })
    const chipOf = (options: Parameters<typeof testSession>[1]): SessionListItemDto =>
      testSession(6, {
        projectDirName: DIR,
        role: testAgentRole('helper', 'code'),
        team: testTeammateTeam(testRef(5, DIR)),
        ...options
      })

    it('leaves its own reasons out of the footnote, since no marker explains them', async () => {
      await showSessions([emptyLead, chipOf({ totalTokens: 9 })])
      const card = await cardOf('Empty lead')

      expect(within(card).queryByText('¹')).toBeNull()
      expect(screen.queryByText(/Partial:/)).toBeNull()
    })

    it("still explains a teammate chip's own marker", async () => {
      await showSessions([emptyLead, chipOf({ transcriptTokens: 400, subagentCount: 1 })])
      const card = await cardOf('Empty lead')

      expect(within(card).getByText('¹')).toBeTruthy()
      expect(screen.getByText(/Partial:/).textContent).toBe(
        "¹ Partial: A session still running or stopped early shows its transcript's tokens, which leave out its subagents."
      )
    })
  })

  it('drops a reason from the footnote when its card is filtered out', async () => {
    await showSessions()
    await cardOf('Refactor parser')
    expect(screen.getByText(/Partial:/)).toBeTruthy()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'plain')

    await cardOf('Plain session')
    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('hides the column header row from assistive technology, since each card says what its figures are', async () => {
    await showSessions()
    await cardOf('Refactor parser')

    expect(screen.getByText('Tokens').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('leaves the marker off a card whose figures are complete', async () => {
    await showSessions()

    const card = await cardOf('Plain session')

    expect(within(card).queryByText('¹')).toBeNull()
  })
})

describe('session cards: search', () => {
  it('keeps the lead of a matching teammate with all its chips and marks only the match', async () => {
    await showSessions()
    await cardOf('Refactor parser')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'review')

    const card = await cardOf('Refactor parser')
    expect(screen.queryByRole('heading', { level: 2, name: 'Plain session' })).toBeNull()
    const reviewerChip = within(card).getByRole('button', { name: /^reviewer \(code\)/ })
    const writerChip = within(card).getByRole('button', { name: /^writer \(code\)/ })
    expect(within(reviewerChip).getByText('matches search')).toBeTruthy()
    expect(within(writerChip).queryByText('matches search')).toBeNull()
  })

  it('highlights a matching chip whatever the case of the search', async () => {
    await showSessions()
    await cardOf('Refactor parser')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'REVIEW')

    const card = await cardOf('Refactor parser')
    expect(within(card).getAllByText('matches search')).toHaveLength(1)
  })

  it('marks no chip when the lead itself matches and no teammate does', async () => {
    await showSessions()
    await cardOf('Refactor parser')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'parser')

    expect(screen.queryByText('matches search')).toBeNull()
    expect(screen.getAllByRole('button', { name: /\(code\)/ })).toHaveLength(2)
  })
})

describe('session cards: opening a session', () => {
  it('opens a session from its title with the keyboard', async () => {
    await showSessions()
    const title = await screen.findByRole('button', { name: 'Refactor parser' })

    title.focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })).toBeTruthy()
    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: testRef(1, DIR),
      selectedAgent: null
    })
  })

  it("opens the lead's session with that teammate selected from a chip with the keyboard", async () => {
    await showSessions()
    const chip = await screen.findByRole('button', { name: /^writer \(code\)/ })

    chip.focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Refactor parser' })).toBeTruthy()
    expect(useNavigationStore.getState()).toMatchObject({
      selectedSessionRef: testRef(1, DIR),
      selectedAgent: { kind: 'teammate', ref: testRef(3, OTHER) }
    })
  })
})

describe('session cards: plan limit note', () => {
  const limited = (resetsAtMs: number): SessionListItemDto =>
    testSession(5, {
      projectDirName: DIR,
      title: 'Hit a limit',
      limitHit: { window: 'sevenDay', resetsAtMs }
    })

  it('notes the plan limit a session hit, and nothing on one that hit none', async () => {
    await showSessions([limited(Date.parse('2099-01-01T00:00:00Z')), solo])

    const card = await cardOf('Hit a limit')

    expect(within(card).getByText(/hit 7-day limit, resets /)).toBeTruthy()
    expect((await cardOf('Plain session')).textContent).not.toContain('hit ')
  })

  it('drops the reset time from a limit note once the reset passes while the view stays open', async () => {
    const nowMs = Date.parse('2026-06-01T00:00:00Z')
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
      now: nowMs,
      shouldAdvanceTime: true
    })
    try {
      await showSessions([limited(nowMs + 60_000)])
      const card = await cardOf('Hit a limit')
      expect(card.textContent).toContain('resets')

      act(() => {
        vi.advanceTimersByTime(60_000)
      })

      expect(card.textContent).toContain('hit 7-day limit')
      expect(card.textContent).not.toContain('resets')
    } finally {
      vi.useRealTimers()
    }
  })
})
