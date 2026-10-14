import { describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../../../../../shared/sessions/testSessionFixtures'
import { testRow } from '../../../../../shared/sessions/testSessionRows'
import { testSessionsT } from '@renderer/features/sessions/testSessionsT'
import { sessionMetaLine } from '../sessionMetaLine'

const MIN = 60_000
const EARLIEST = Date.parse('2026-01-15T11:00:00Z')

/** The meta line of the first session among `items`. */
function lineOf(...items: SessionListItemDto[]): readonly string[] {
  return sessionMetaLine(testRow(1, items), testSessionsT)
}

describe('sessionMetaLine', () => {
  it('gives start, team and agents in that order for a lead with a team', () => {
    const lead = testSession(1, {
      earliestMs: EARLIEST,
      latestMs: EARLIEST + 85 * MIN,
      subagentCount: 3,
      team: testLeadTeam([testRef(2)], testUsage({ teamTokens: 3_100_000, teamUSD: 13.23 }))
    })
    const mate = testSession(2, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(1))
    })

    expect(lineOf(lead, mate)).toEqual([
      testSessionsT('lastActive', { value: EARLIEST }),
      'team team',
      '1 teammate, 3 subagents'
    ])
  })

  it('starts at the first record, not the last', () => {
    const lead = testSession(1, { earliestMs: EARLIEST, latestMs: EARLIEST + 3 * 24 * 60 * MIN })

    expect(lineOf(lead)[0]).toBe(testSessionsT('lastActive', { value: EARLIEST }))
  })

  it('leaves out the duration, tokens and cost, which the stat row shows', () => {
    const solo = testSession(1, {
      earliestMs: EARLIEST,
      latestMs: EARLIEST + 5 * MIN,
      totalTokens: 1500,
      costUSD: 0.5
    })

    expect(lineOf(solo)).toEqual([testSessionsT('lastActive', { value: EARLIEST })])
  })

  it('leaves out the start when the session has no timestamps', () => {
    expect(lineOf(testSession(1, { totalTokens: 10, subagentCount: 2 }))).toEqual(['2 subagents'])
  })

  it('leaves out the agents when the session used none', () => {
    expect(lineOf(testSession(1, { subagentCount: 0, totalTokens: 10 }))).not.toContain('None')
  })

  it('leaves out the agents when the subagent count is unknown', () => {
    expect(lineOf(testSession(1, { subagentCount: null, totalTokens: 10 }))).toEqual([])
  })

  it('is empty for a session whose summary could not be read', () => {
    expect(lineOf(testSession(1, { unreadable: true }))).toEqual([])
  })

  it('names the team of an agent session from its role', () => {
    const mate = testSession(1, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(9))
    })

    expect(lineOf(mate)).toContain('team team')
  })

  it('names the team of an ungrouped session from its team entry', () => {
    const orphan = testSession(1, { team: { kind: 'ungrouped', teamName: 'auth-migration' } })

    expect(lineOf(orphan)).toContain('team auth-migration')
  })

  it('names the team of a lead from its first teammate that has one', () => {
    const lead = testSession(1, { team: testLeadTeam([testRef(2), testRef(3)]) })
    const unnamed = testSession(2, {
      role: { kind: 'agent', agentName: 'a', agentType: 'code', teamName: null },
      team: testTeammateTeam(testRef(1))
    })
    const named = testSession(3, {
      role: { kind: 'agent', agentName: 'b', agentType: 'code', teamName: 'auth-migration' },
      team: testTeammateTeam(testRef(1))
    })

    expect(lineOf(lead, unnamed, named)).toContain('team auth-migration')
  })
})
