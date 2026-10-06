import { describe, expect, it } from 'vitest'
import type { AgentSearchTermDto } from '../../../../../shared/ipc/sessionListDto'
import { groupSessionRows } from '../groupSessionRows'
import { matchedAgentOf, normalizeQuery, rowMatches } from '../sessionMatches'
import type { SessionRow } from '../sessionRow'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const term = (overrides: Partial<AgentSearchTermDto>): AgentSearchTermDto => ({
  name: null,
  description: null,
  agentType: 'Misc',
  ...overrides
})

/** The one top-level row of a session with these terms. */
function rowWith(agentTerms: readonly AgentSearchTermDto[], title = 'Refactor parser'): SessionRow {
  const [row] = groupSessionRows(
    [testSession(1, { title, latestMs: 1, agentTerms })],
    testSessionsT
  )
  if (row === undefined) throw new Error('No row')
  return row
}

describe('rowMatches', () => {
  it.each([
    ['name', term({ name: 'Scout' }), 'scout'],
    ['description', term({ description: 'Map the auth flow' }), 'auth flow'],
    ['type', term({ agentType: 'Explore' }), 'explor']
  ])('matches a subagent by its %s', (_field, agent, needle) => {
    expect(rowMatches(rowWith([agent]), needle)).toBe(true)
  })

  it('matches the case of the typed query to the case of the term', () => {
    const row = rowWith([term({ name: 'ScOuT' })])

    expect(rowMatches(row, normalizeQuery('  SCOUT '))).toBe(true)
  })

  it('matches any one of several subagents', () => {
    expect(rowMatches(rowWith([term({ name: 'a' }), term({ name: 'planner' })]), 'plan')).toBe(true)
  })

  it('does not match text that spans two fields', () => {
    expect(rowMatches(rowWith([term({ name: 'ab', description: 'cd' })]), 'bc')).toBe(false)
  })

  it('does not match a field that is absent', () => {
    expect(rowMatches(rowWith([term({ name: 'scout' })]), 'null')).toBe(false)
  })

  it('still matches the session label', () => {
    expect(rowMatches(rowWith([]), 'parser')).toBe(true)
  })

  it('matches nothing for a session with no subagent terms and another label', () => {
    expect(rowMatches(rowWith([]), 'scout')).toBe(false)
  })
})

describe('matchedAgentOf', () => {
  const scout = term({ name: 'scout', description: 'Map the auth flow', agentType: 'Explore' })

  it('names the subagent when only a subagent matches', () => {
    expect(matchedAgentOf(rowWith([scout]), 'auth')).toBe('scout')
  })

  it('names the first of several matching subagents', () => {
    const row = rowWith([
      term({ name: 'first', agentType: 'Plan' }),
      term({ name: 'second', agentType: 'Plan' })
    ])

    expect(matchedAgentOf(row, 'plan')).toBe('first')
  })

  it('names the type when the subagent has no name', () => {
    expect(matchedAgentOf(rowWith([term({ agentType: 'Explore', description: 'x' })]), 'x')).toBe(
      'Explore'
    )
  })

  it('names nothing when the session’s label also matches', () => {
    expect(matchedAgentOf(rowWith([scout], 'Scout the auth flow'), 'auth')).toBeNull()
  })

  it('names nothing when the search is blank', () => {
    expect(matchedAgentOf(rowWith([scout]), '')).toBeNull()
  })

  it('names nothing when no subagent matches', () => {
    expect(matchedAgentOf(rowWith([scout]), 'zzz')).toBeNull()
  })

  it('names nothing when a teammate matches, since its chip shows the match', () => {
    const lead = testSession(1, {
      title: 'Lead',
      latestMs: 1,
      team: testLeadTeam([testRef(2)]),
      agentTerms: [scout, term({ agentType: 'code-reviewer' })]
    })
    const mate = testSession(2, {
      role: testAgentRole('reviewer', 'code'),
      team: testTeammateTeam(testRef(1))
    })
    const [row] = groupSessionRows([lead, mate], testSessionsT)

    expect(matchedAgentOf(row as SessionRow, 'review')).toBeNull()
    expect(matchedAgentOf(row as SessionRow, 'auth')).toBe('scout')
  })

  it('names nothing when a teammate and the session’s own subagent both match', () => {
    const lead = testSession(1, {
      title: 'Lead',
      latestMs: 1,
      team: testLeadTeam([testRef(2)]),
      agentTerms: [scout]
    })
    const mate = testSession(2, {
      role: testAgentRole('reviewer', 'code'),
      team: testTeammateTeam(testRef(1)),
      agentTerms: [term({ name: 'auth-checker' })]
    })
    const [row] = groupSessionRows([lead, mate], testSessionsT)

    expect(matchedAgentOf(row as SessionRow, 'auth')).toBeNull()
  })

  it('names nothing when a teammate’s own subagent matches, since its chip shows the match', () => {
    const lead = testSession(1, {
      title: 'Lead',
      latestMs: 1,
      team: testLeadTeam([testRef(2)]),
      agentTerms: [scout]
    })
    const mate = testSession(2, {
      role: testAgentRole('reviewer', 'code'),
      team: testTeammateTeam(testRef(1)),
      agentTerms: [term({ name: 'checker' })]
    })
    const [row] = groupSessionRows([lead, mate], testSessionsT)

    expect(matchedAgentOf(row as SessionRow, 'checker')).toBeNull()
  })
})
