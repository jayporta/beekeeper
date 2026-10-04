import { describe, expect, it } from 'vitest'
import { filterRows } from '../filterRows'
import { groupSessionRows } from '../groupSessionRows'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testSessionId,
  testTeammateTeam
} from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const lead = testSession(1, {
  title: 'Refactor parser',
  latestMs: 9,
  team: testLeadTeam([testRef(2), testRef(3)])
})
const mateA = testSession(2, {
  role: testAgentRole('reviewer', 'code'),
  team: testTeammateTeam(testRef(1))
})
const mateB = testSession(3, {
  role: testAgentRole('writer', 'code'),
  team: testTeammateTeam(testRef(1))
})
const other = testSession(4, { title: 'Fix the login bug', latestMs: 1 })
const rows = groupSessionRows([lead, mateA, mateB, other], testSessionsT)
const keyOf = (n: number): string => `-p/${testSessionId(n)}`

describe('filterRows', () => {
  it('keeps every row for a blank query', () => {
    expect(filterRows(rows, '')).toBe(rows)
    expect(filterRows(rows, '   ')).toBe(rows)
  })

  it('matches a label case-insensitively by substring', () => {
    expect(filterRows(rows, 'LOGIN').map((row) => row.key)).toEqual([keyOf(4)])
  })

  it('keeps a lead that matches, with all its teammates', () => {
    const [kept] = filterRows(rows, 'parser')

    expect(kept?.key).toBe(keyOf(1))
    expect(kept?.teammates.map((t) => t.key)).toEqual([keyOf(2), keyOf(3)])
  })

  it('keeps a lead when only a teammate matches, with all its teammates', () => {
    const result = filterRows(rows, 'review')

    expect(result.map((row) => row.key)).toEqual([keyOf(1)])
    expect(result[0]?.teammates.map((t) => t.key)).toEqual([keyOf(2), keyOf(3)])
  })

  it('matches a teammate by its agent name and type label', () => {
    expect(filterRows(rows, 'writer (code)').map((row) => row.key)).toEqual([keyOf(1)])
  })

  it('keeps a session whose subagent matches by name, description or type', () => {
    const withAgents = testSession(5, {
      title: 'Untouched title',
      latestMs: 0,
      agentTerms: [{ name: 'scout', description: 'Map auth', agentType: 'Explore' }]
    })
    const all = groupSessionRows([...rows.map((row) => row.item), withAgents], testSessionsT)

    for (const query of ['SCOUT', 'map auth', 'explore']) {
      expect(filterRows(all, query).map((row) => row.key)).toEqual([keyOf(5)])
    }
  })

  it('keeps a lead, with all its teammates, when only a teammate’s subagent matches', () => {
    const mateWithAgent = testSession(2, {
      role: testAgentRole('reviewer', 'code'),
      team: testTeammateTeam(testRef(1)),
      agentTerms: [{ name: 'checker', description: null, agentType: null }]
    })
    const all = groupSessionRows([lead, mateWithAgent, mateB, other], testSessionsT)

    const result = filterRows(all, 'checker')

    expect(result.map((row) => row.key)).toEqual([keyOf(1)])
    expect(result[0]?.teammates.map((t) => t.key)).toEqual([keyOf(2), keyOf(3)])
  })

  it('returns nothing when no row matches', () => {
    expect(filterRows(rows, 'zzz')).toEqual([])
  })
})
