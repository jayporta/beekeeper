import { describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { groupSessionRows } from '../groupSessionRows'
import { partialReasons, type PartialReason } from '../partialReasons'
import { sessionKey } from '../sessionKey'
import type { SessionRow } from '../sessionRow'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

/** The card for session `n`, grouped with the other sessions as the list would. */
function cardFor(n: number, items: readonly SessionListItemDto[]): SessionRow {
  const target = items.find((item) => item.sessionId === testSession(n).sessionId)
  const row = groupSessionRows(items, testSessionsT).find(
    (candidate) => target !== undefined && candidate.key === sessionKey(target)
  )
  if (row === undefined) throw new Error(`no card for session ${n}`)
  return row
}

const reasons = (row: SessionRow): PartialReason[] => [...partialReasons(row)].sort()

/** A lead (session 1) with one teammate (session 2) that can be adjusted. */
function teamCard(
  usage = testUsage(),
  teammate: Parameters<typeof testSession>[1] = {}
): SessionRow {
  const lead = testSession(1, { team: testLeadTeam([testRef(2)], usage) })
  const mate = testSession(2, {
    role: testAgentRole('reviewer', 'code'),
    team: testTeammateTeam(testRef(1)),
    ...teammate
  })
  return cardFor(1, [lead, mate])
}

describe('partialReasons', () => {
  it('has no reasons for a clean solo session', () => {
    const solo = testSession(1, { totalTokens: 5, costUSD: 1 })

    expect(reasons(cardFor(1, [solo]))).toEqual([])
  })

  it('has no reasons for a clean lead and its teammate', () => {
    expect(reasons(teamCard())).toEqual([])
  })

  it('does not call a solo session with no recorded usage unrecorded usage', () => {
    expect(reasons(cardFor(1, [testSession(1)]))).toEqual([])
  })

  describe('unreadableLines', () => {
    it('applies when the card’s own session skipped lines', () => {
      expect(reasons(cardFor(1, [testSession(1, { skippedLines: 2 })]))).toEqual([
        'unreadableLines'
      ])
    })

    it('applies when a teammate under the card skipped lines', () => {
      expect(reasons(teamCard(testUsage(), { skippedLines: 1 }))).toEqual(['unreadableLines'])
    })

    it('does not apply to a session whose summary could not be read', () => {
      expect(reasons(cardFor(1, [testSession(1, { unreadable: true })]))).toEqual([])
    })
  })

  describe('missingTeammates', () => {
    it('applies when a spawned teammate is not in the list', () => {
      expect(reasons(teamCard(testUsage({ missingTeammates: 1 })))).toEqual(['missingTeammates'])
    })

    it('applies when the lead’s spawn or stop lists were capped', () => {
      expect(reasons(teamCard(testUsage({ teamListsTruncated: true })))).toEqual([
        'missingTeammates'
      ])
    })
  })

  describe('unrecordedUsage', () => {
    it.each([
      ['a session with no tokens', { sessionsWithoutTokens: 1 }],
      ['a session with no cost', { sessionsWithoutCost: 1 }],
      ['a lead whose own tokens are unrecorded', { leadTokens: null }]
    ])('applies to a lead with %s', (_label, overrides) => {
      expect(reasons(teamCard(testUsage(overrides)))).toEqual(['unrecordedUsage'])
    })
  })

  describe('subagentsExcluded', () => {
    it('applies when a session shows its transcript tokens and has subagents', () => {
      const item = testSession(1, { transcriptTokens: 900, subagentCount: 2 })

      expect(reasons(cardFor(1, [item]))).toEqual(['subagentsExcluded'])
    })

    it('applies when the subagent count is unknown', () => {
      const item = testSession(1, { transcriptTokens: 900, subagentCount: null })

      expect(reasons(cardFor(1, [item]))).toEqual(['subagentsExcluded'])
    })

    it('does not apply to a transcript total with no subagents', () => {
      const item = testSession(1, { transcriptTokens: 900, subagentCount: 0 })

      expect(reasons(cardFor(1, [item]))).toEqual([])
    })

    it('does not apply to recorded tokens, whatever the subagent count', () => {
      const item = testSession(1, { totalTokens: 5, transcriptTokens: 900, subagentCount: 2 })

      expect(reasons(cardFor(1, [item]))).toEqual([])
    })

    it('applies when a teammate’s chip shows transcript tokens that leave out its subagents', () => {
      expect(reasons(teamCard(testUsage(), { transcriptTokens: 400, subagentCount: 1 }))).toEqual([
        'subagentsExcluded'
      ])
    })

    it('applies to a running lead whose own tokens are shown because nothing was recorded', () => {
      const usage = testUsage({
        leadTokens: null,
        leadUSD: null,
        teamTokens: null,
        teamUSD: null,
        sessionsWithoutTokens: 2
      })
      const lead = testSession(1, {
        team: testLeadTeam([testRef(2)], usage),
        transcriptTokens: 900,
        subagentCount: 1
      })
      const mate = testSession(2, { team: testTeammateTeam(testRef(1)) })

      expect(reasons(cardFor(1, [lead, mate]))).toEqual(['subagentsExcluded', 'unrecordedUsage'])
    })

    it('does not apply to a running lead whose shown figure is the team total', () => {
      const usage = testUsage({
        leadTokens: null,
        leadUSD: null,
        teamTokens: 300,
        teamUSD: 3,
        sessionsWithoutTokens: 1
      })
      const lead = testSession(1, {
        team: testLeadTeam([testRef(2)], usage),
        transcriptTokens: 900,
        subagentCount: 1
      })
      const mate = testSession(2, { team: testTeammateTeam(testRef(1)) })

      expect(reasons(cardFor(1, [lead, mate]))).toEqual(['unrecordedUsage'])
    })
  })

  it('collects every reason that applies', () => {
    const usage = testUsage({ missingTeammates: 1, sessionsWithoutCost: 1 })

    expect(reasons(teamCard(usage, { skippedLines: 1 }))).toEqual([
      'missingTeammates',
      'unreadableLines',
      'unrecordedUsage'
    ])
  })
})
