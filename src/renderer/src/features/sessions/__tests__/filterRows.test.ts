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

  it('keeps a lead that matches, with no teammates when none match', () => {
    const [kept] = filterRows(rows, 'parser')

    expect(kept?.key).toBe(keyOf(1))
    expect(kept?.teammates).toEqual([])
  })

  it('keeps a lead when only a teammate matches, with just the matching teammates', () => {
    const result = filterRows(rows, 'review')

    expect(result.map((row) => row.key)).toEqual([keyOf(1)])
    expect(result[0]?.teammates.map((t) => t.key)).toEqual([keyOf(2)])
  })

  it('matches a teammate by its agent name and type label', () => {
    expect(filterRows(rows, 'writer (code)')[0]?.teammates.map((t) => t.key)).toEqual([keyOf(3)])
  })

  it('returns the original row object when all of its teammates match', () => {
    const [kept] = filterRows(rows, 'code')

    expect(kept).toBe(rows[0])
  })

  it('returns a new row object when some of its teammates are filtered out', () => {
    const [kept] = filterRows(rows, 'review')

    expect(kept).not.toBe(rows[0])
    expect(rows[0]?.teammates).toHaveLength(2)
  })

  it('returns nothing when no row matches', () => {
    expect(filterRows(rows, 'zzz')).toEqual([])
  })

  it('does not change the rows it was given', () => {
    filterRows(rows, 'review')

    expect(rows[0]?.teammates).toHaveLength(2)
  })
})
