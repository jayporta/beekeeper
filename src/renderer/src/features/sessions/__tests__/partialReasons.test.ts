import { describe, expect, it } from 'vitest'
import { figureReasons, partialReasons, type PartialReason } from '../partialReasons'
import type { SessionRow } from '../sessionRow'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../testSessionFixtures'
import { testRow } from '../testSessionRows'

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
  return testRow(1, [lead, mate])
}

describe('partialReasons', () => {
  it('has no reasons for a clean solo session', () => {
    const solo = testSession(1, { totalTokens: 5, costUSD: 1 })

    expect(reasons(testRow(1, [solo]))).toEqual([])
  })

  it('has no reasons for a clean lead and its teammate', () => {
    expect(reasons(teamCard())).toEqual([])
  })

  it('does not call a solo session with no recorded usage unrecorded usage', () => {
    expect(reasons(testRow(1, [testSession(1)]))).toEqual([])
  })

  describe('unreadableLines', () => {
    it('applies when the card’s own session skipped lines', () => {
      expect(reasons(testRow(1, [testSession(1, { skippedLines: 2, totalTokens: 5 })]))).toEqual([
        'unreadableLines'
      ])
    })

    it('applies when a teammate under the card skipped lines', () => {
      expect(reasons(teamCard(testUsage(), { skippedLines: 1 }))).toEqual(['unreadableLines'])
    })

    it('does not apply to a session whose summary could not be read', () => {
      expect(reasons(testRow(1, [testSession(1, { unreadable: true })]))).toEqual([])
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
      ['a session with no cost', { sessionsWithoutCost: 1 }]
    ])('applies to a lead with %s', (_label, overrides) => {
      expect(reasons(teamCard(testUsage(overrides)))).toEqual(['unrecordedUsage'])
    })
  })

  describe('subagentsExcluded', () => {
    it('applies when a session shows its transcript tokens and has subagents', () => {
      const item = testSession(1, { transcriptTokens: 900, subagentCount: 2 })

      expect(reasons(testRow(1, [item]))).toEqual(['subagentsExcluded'])
    })

    it('applies when the subagent count is unknown', () => {
      const item = testSession(1, { transcriptTokens: 900, subagentCount: null })

      expect(reasons(testRow(1, [item]))).toEqual(['subagentsExcluded'])
    })

    it('does not apply to a transcript total with no subagents', () => {
      const item = testSession(1, { transcriptTokens: 900, subagentCount: 0 })

      expect(reasons(testRow(1, [item]))).toEqual([])
    })

    it('does not apply to recorded tokens, whatever the subagent count', () => {
      const item = testSession(1, { totalTokens: 5, transcriptTokens: 900, subagentCount: 2 })

      expect(reasons(testRow(1, [item]))).toEqual([])
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

      expect(reasons(testRow(1, [lead, mate]))).toEqual(['subagentsExcluded', 'unrecordedUsage'])
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

      expect(reasons(testRow(1, [lead, mate]))).toEqual(['unrecordedUsage'])
    })
  })

  describe('a card that shows no figures', () => {
    const nothingRecorded = {
      leadTokens: null,
      leadUSD: null,
      teamTokens: null,
      teamUSD: null,
      sessionsWithoutTokens: 1,
      missingTeammates: 1
    }

    it('has no reasons of its own, since no marker is shown to explain', () => {
      expect(reasons(teamCard(testUsage(nothingRecorded), { skippedLines: 1 }))).toEqual([])
    })

    it('still reports a teammate chip that shows a transcript total, since the chip has its own marker', () => {
      const card = teamCard(testUsage(nothingRecorded), { transcriptTokens: 400, subagentCount: 1 })

      expect(reasons(card)).toEqual(['subagentsExcluded'])
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

describe('figureReasons', () => {
  it('leaves out the subagents a teammate’s chip excludes, since the detail shows no chips', () => {
    const card = teamCard(testUsage(), { transcriptTokens: 400, subagentCount: 1 })

    expect([...figureReasons(card)]).toEqual([])
    expect([...partialReasons(card)]).toEqual(['subagentsExcluded'])
  })

  it('collects the reasons of the session’s own figures', () => {
    const usage = testUsage({ missingTeammates: 1, sessionsWithoutCost: 1 })

    expect([...figureReasons(teamCard(usage, { skippedLines: 1 }))].sort()).toEqual([
      'missingTeammates',
      'unreadableLines',
      'unrecordedUsage'
    ])
  })
})
