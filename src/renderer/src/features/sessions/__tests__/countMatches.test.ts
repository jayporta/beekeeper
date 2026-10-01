import { describe, expect, it } from 'vitest'
import { countMatches } from '../countMatches'
import { groupSessionRows } from '../groupSessionRows'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
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

describe('countMatches', () => {
  it('counts every session whose label matches, leads and teammates alike', () => {
    expect(countMatches(rows, 'code')).toBe(2)
    expect(countMatches(rows, 'r')).toBe(3)
  })

  it('does not count a lead that is shown only because a teammate matches', () => {
    expect(countMatches(rows, 'review')).toBe(1)
  })

  it('counts nothing when nothing matches', () => {
    expect(countMatches(rows, 'zzz')).toBe(0)
  })

  it('is case-insensitive and ignores surrounding spaces', () => {
    expect(countMatches(rows, '  LOGIN ')).toBe(1)
  })
})
