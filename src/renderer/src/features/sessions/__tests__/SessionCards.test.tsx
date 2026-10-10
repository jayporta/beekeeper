import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../shared/ipc/emptyAgentSignals'
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
function cardOf(name: string | RegExp): HTMLElement {
  const title = screen.getByRole('heading', { level: 2, name })
  return title.closest('li') as HTMLElement
}

describe('session cards', () => {
  it('lists one card per lead or solo session, newest first, in a list named by the project', async () => {
    await showSessions()

    const list = screen.getByRole('list', { name: DIR })

    expect(
      within(list)
        .getAllByRole('heading', { level: 2 })
        .map((title) => title.textContent)
    ).toEqual(['Refactor parser', 'Plain session'])
  })

  it('shows a lead with its agent count, team total, and a chip for each teammate', async () => {
    await showSessions()

    const card = cardOf('Refactor parser')

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

    const card = cardOf('Refactor parser')

    expect(within(card).getByText('Agents')).toBeTruthy()
    expect(within(card).getByText('Duration')).toBeTruthy()
  })

  it('shows the last active time, model, and duration of a session', async () => {
    await showSessions()

    const card = cardOf('Refactor parser')

    expect(within(card).getByText(/2026.*claude-opus-5/)).toBeTruthy()
    expect(within(card).getByText('1h')).toBeTruthy()
    expect(within(card).getByText('Duration')).toBeTruthy()
  })

  it('shows a solo session with subagents with no chips, no team total, and "at API prices"', async () => {
    await showSessions()

    const card = cardOf('Plain session')

    expect(within(card).getByText('2 subagents')).toBeTruthy()
    expect(within(card).getByText('$0.50 at API prices')).toBeTruthy()
    expect(within(card).queryByText('team total')).toBeNull()
    expect(within(card).queryByRole('list')).toBeNull()
  })

  it('marks a missing value as not recorded and a tiny cost as under a cent', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, title: 'Cheap', costUSD: 0.004 })])

    const card = cardOf('Cheap')

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

    const card = cardOf('Still running')

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

    const card = cardOf('Lost its team')

    expect(within(card).getByText('team total')).toBeTruthy()
    expect(within(card).getByText('¹')).toBeTruthy()
    expect(within(card).queryByRole('list')).toBeNull()
  })

  it('names the true agent count when there are more agents than marks', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, title: 'Busy', subagentCount: 40 })])

    const card = cardOf('Busy')

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

    const card = cardOf('stray (code)')

    expect(within(card).getByText(/lead in -Users-a-other/)).toBeTruthy()
  })

  it('shows an unreadable session as a placeholder card with spoken missing values, still openable', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, unreadable: true })])

    const card = cardOf('Unreadable session')

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

    const card = cardOf(hostile)

    expect(within(card).getByRole('list', { name: `Teammates of ${hostile}` })).toBeTruthy()
  })
})

describe('session cards: legend', () => {
  it('names the kinds of mark on screen', async () => {
    await showSessions()
    cardOf('Refactor parser')

    expect(screen.getByText('Lead')).toBeTruthy()
    expect(screen.getByText('Teammate')).toBeTruthy()
    expect(screen.getByText('Subagent')).toBeTruthy()
  })

  it('leaves out the kinds that no card on screen draws', async () => {
    await showSessions([testSession(5, { projectDirName: DIR, title: 'On its own' })])
    cardOf('On its own')

    expect(screen.getByText('Lead')).toBeTruthy()
    expect(screen.queryByText('Teammate')).toBeNull()
    expect(screen.queryByText('Subagent')).toBeNull()
  })
})

describe('session cards: partial figures', () => {
  it('shows no footnote when no figure is partial', async () => {
    await showSessions([solo])
    cardOf('Plain session')

    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('shows a marker on the partial card and a footnote naming exactly the reasons on screen', async () => {
    await showSessions()

    const card = cardOf('Refactor parser')

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
    cardOf('Garbled')

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
    cardOf('Also short a teammate')

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
      const card = cardOf('Empty lead')

      expect(within(card).queryByText('¹')).toBeNull()
      expect(screen.queryByText(/Partial:/)).toBeNull()
    })

    it("still explains a teammate chip's own marker", async () => {
      await showSessions([emptyLead, chipOf({ transcriptTokens: 400, subagentCount: 1 })])
      const card = cardOf('Empty lead')

      expect(within(card).getByText('¹')).toBeTruthy()
      expect(screen.getByText(/Partial:/).textContent).toBe(
        "¹ Partial: A session still running or stopped early shows its transcript's tokens, which leave out its subagents."
      )
    })
  })

  it('drops a reason from the footnote when its card is filtered out', async () => {
    await showSessions()
    cardOf('Refactor parser')
    expect(screen.getByText(/Partial:/)).toBeTruthy()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'plain')

    cardOf('Plain session')
    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('hides the column header row from assistive technology, since each card says what its figures are', async () => {
    await showSessions()
    cardOf('Refactor parser')

    expect(screen.getByText('Tokens').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('leaves the marker off a card whose figures are complete', async () => {
    await showSessions()

    const card = cardOf('Plain session')

    expect(within(card).queryByText('¹')).toBeNull()
  })
})

describe('session cards: search', () => {
  it('keeps the lead of a matching teammate with all its chips and marks only the match', async () => {
    await showSessions()
    cardOf('Refactor parser')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'review')

    const card = cardOf('Refactor parser')
    expect(screen.queryByRole('heading', { level: 2, name: 'Plain session' })).toBeNull()
    const reviewerChip = within(card).getByRole('button', { name: /^reviewer \(code\)/ })
    const writerChip = within(card).getByRole('button', { name: /^writer \(code\)/ })
    expect(within(reviewerChip).getByText('matches search')).toBeTruthy()
    expect(within(writerChip).queryByText('matches search')).toBeNull()
  })

  it('highlights a matching chip whatever the case of the search', async () => {
    await showSessions()
    cardOf('Refactor parser')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'REVIEW')

    const card = cardOf('Refactor parser')
    expect(within(card).getAllByText('matches search')).toHaveLength(1)
  })

  it('marks no chip when the lead itself matches and no teammate does', async () => {
    await showSessions()
    cardOf('Refactor parser')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'parser')

    expect(screen.queryByText('matches search')).toBeNull()
    expect(screen.getAllByRole('button', { name: /\(code\)/ })).toHaveLength(2)
  })
})

describe('session cards: opening a session', () => {
  it('opens a session from its title with the keyboard', async () => {
    await showSessions()
    const title = screen.getByRole('button', { name: 'Refactor parser' })

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
    const chip = screen.getByRole('button', { name: /^writer \(code\)/ })

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

    const card = cardOf('Hit a limit')

    expect(within(card).getByText(/hit 7-day limit, resets /)).toBeTruthy()
    expect(cardOf('Plain session').textContent).not.toContain('hit ')
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
      const card = cardOf('Hit a limit')
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

describe('session cards: signal notes', () => {
  const counts = { toolErrors: 12, compactions: 2, agentsKilled: 0, partial: false }
  const noisy = testSession(5, {
    projectDirName: DIR,
    title: 'Went off the rails',
    signals: { ...EMPTY_AGENT_SIGNALS_DTO, ...counts }
  })
  const teamLead = testSession(6, {
    projectDirName: DIR,
    title: 'Team lead',
    signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 1 },
    team: testLeadTeam([testRef(7, DIR)], testUsage({ signalTotals: counts }))
  })
  const teammate = testSession(7, {
    projectDirName: DIR,
    role: testAgentRole('helper', 'code'),
    team: testTeammateTeam(testRef(6, DIR))
  })
  const unreadable = testSession(8, { projectDirName: DIR, title: 'Hidden', unreadable: true })
  const SCOPE = /^Card counts cover the lead and its teammates/

  it('notes the tool errors and compactions on a card, and nothing on a quiet one', async () => {
    await showSessions([noisy, solo])

    expect(cardOf('Went off the rails').textContent).toContain('12 tool errors · 2 compactions')
    expect(cardOf('Plain session').textContent).not.toContain('tool error')
  })

  it('notes a lead with the team totals rather than its own counts', async () => {
    await showSessions([teamLead, teammate])

    expect(cardOf('Team lead').textContent).toContain('12 tool errors · 2 compactions')
  })

  it('renders a lead and its unreadable teammate, the lead noting its team totals', async () => {
    // Main gives an unreadable session no team entry and leaves it out of its lead's group
    // (guarded in listSessionsTeam.test.ts), so the lead lists no teammate and counts it as missing.
    const leadOfUnreadable = testSession(9, {
      projectDirName: DIR,
      title: 'Lead of a lost teammate',
      signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 1 },
      team: testLeadTeam([], testUsage({ missingTeammates: 1, signalTotals: counts }))
    })
    const lostTeammate = testSession(10, {
      projectDirName: DIR,
      role: testAgentRole('lost', 'code'),
      unreadable: true
    })
    await showSessions([leadOfUnreadable, lostTeammate])

    const leadCard = cardOf('Lead of a lost teammate')
    const lostCard = cardOf('Unreadable session')

    expect(leadCard.textContent).toContain('12 tool errors · 2 compactions')
    expect(lostCard.textContent).not.toContain('tool error')
  })

  it('says what the counts cover once, below the list, when a card has a count', async () => {
    await showSessions([noisy, solo])
    cardOf('Went off the rails')

    expect(screen.getAllByText(SCOPE)).toHaveLength(1)
  })

  it('leaves the scope note out when no card has a count', async () => {
    await showSessions([solo])
    cardOf('Plain session')

    expect(screen.queryByText(SCOPE)).toBeNull()
  })

  describe('when a transcript hit the event cap', () => {
    const NOTE = 'partial, see the note below the list'
    const SENTENCE = /Some transcripts have more events than beekeeper counts/
    const capped = testSession(11, {
      projectDirName: DIR,
      title: 'Capped transcript',
      totalTokens: 7,
      costUSD: 0.5,
      signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 2, partial: true }
    })

    it('marks the signal counts and explains why in the footnote', async () => {
      await showSessions([capped])

      const card = cardOf('Capped transcript')

      expect(card.textContent).toContain(`2 tool errors¹${NOTE}`)
      expect(screen.getByText(SENTENCE)).toBeTruthy()
    })

    it('leaves the token figure unmarked when only the signals are partial', async () => {
      await showSessions([capped])

      const card = cardOf('Capped transcript')

      expect(card.querySelectorAll('sup')).toHaveLength(1)
    })

    it('marks a lead’s team counts when its team totals are partial', async () => {
      const partialLead = testSession(12, {
        projectDirName: DIR,
        title: 'Partial team',
        team: testLeadTeam(
          [testRef(13, DIR)],
          testUsage({ signalTotals: { ...counts, partial: true } })
        )
      })
      await showSessions([partialLead])

      expect(cardOf('Partial team').textContent).toContain(`2 compactions¹${NOTE}`)
    })

    it('marks nothing when the partial signals have every count at zero', async () => {
      const quiet = testSession(14, {
        projectDirName: DIR,
        title: 'Quiet but capped',
        totalTokens: 7,
        costUSD: 0.5,
        signals: { ...EMPTY_AGENT_SIGNALS_DTO, partial: true }
      })
      await showSessions([quiet])

      expect(cardOf('Quiet but capped').querySelectorAll('sup')).toHaveLength(0)
      expect(screen.queryByText(SENTENCE)).toBeNull()
    })

    it('says nothing about it when no signal counts are partial', async () => {
      await showSessions([noisy])
      cardOf('Went off the rails')

      expect(screen.queryByText(SENTENCE)).toBeNull()
    })
  })

  it('still renders a card whose summary failed, with no signal note or scope note', async () => {
    await showSessions([unreadable])

    const card = cardOf('Unreadable session')

    expect(card.textContent).not.toContain('tool error')
    expect(screen.queryByText(SCOPE)).toBeNull()
  })
})

describe('session cards: archived note', () => {
  const archived = testSession(6, {
    projectDirName: DIR,
    title: 'Removed from disk',
    latestMs: Date.parse('2026-01-10T12:00:00Z'),
    archived: true
  })

  it('notes an archived session, and nothing on one read from disk', async () => {
    await showSessions([archived, solo])

    const card = cardOf('Removed from disk')

    expect(within(card).getByText(/archived/)).toBeTruthy()
    expect(cardOf('Plain session').textContent).not.toContain('archived')
  })

  it('sorts an archived session among the others by when it was last active', async () => {
    // The handler lists live sessions first and appends archived ones, so sorting has to move it.
    await showSessions([solo, archived])

    const list = screen.getByRole('list', { name: DIR })

    expect(
      within(list)
        .getAllByRole('heading', { level: 2 })
        .map((title) => title.textContent)
    ).toEqual(['Removed from disk', 'Plain session'])
  })

  it('finds an archived session by its title in a search', async () => {
    await showSessions([archived, solo])

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search sessions' }), 'removed')

    expect(screen.getByRole('heading', { level: 2, name: 'Removed from disk' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Plain session' })).toBeNull()
  })
})
