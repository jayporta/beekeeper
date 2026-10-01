import { describe, expect, it } from 'vitest'
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

const keys = (rows: ReturnType<typeof groupSessionRows>): string[] => rows.map((row) => row.key)
const keyOf = (n: number, dir = '-p'): string => `${dir}/${testSessionId(n)}`

describe('groupSessionRows', () => {
  it('returns no rows for no sessions', () => {
    expect(groupSessionRows([], testSessionsT)).toEqual([])
  })

  it('nests a lead teammates in the lead order and not at top level', () => {
    const lead = testSession(1, { latestMs: 5, team: testLeadTeam([testRef(3), testRef(2)]) })
    const a = testSession(2, { role: testAgentRole('a', 't'), team: testTeammateTeam(testRef(1)) })
    const b = testSession(3, { role: testAgentRole('b', 't'), team: testTeammateTeam(testRef(1)) })

    const rows = groupSessionRows([a, b, lead], testSessionsT)

    expect(keys(rows)).toEqual([keyOf(1)])
    expect(keys(rows[0]?.teammates ?? [])).toEqual([keyOf(3), keyOf(2)])
  })

  it('labels every row, including the teammates nested under a lead', () => {
    const lead = testSession(1, { title: 'Refactor', team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      role: testAgentRole('reviewer', 'code'),
      team: testTeammateTeam(testRef(1))
    })

    const [row] = groupSessionRows([lead, mate], testSessionsT)

    expect(row?.label.text).toBe('Refactor')
    expect(row?.teammates[0]?.label.text).toBe('reviewer (code)')
  })

  it('nests a cross-folder teammate under its lead', () => {
    const lead = testSession(1, { team: testLeadTeam([testRef(2, '-other')]) })
    const mate = testSession(2, {
      projectDirName: '-other',
      role: testAgentRole('a', 't'),
      team: testTeammateTeam(testRef(1))
    })

    const rows = groupSessionRows([lead, mate], testSessionsT)

    expect(keys(rows)).toEqual([keyOf(1)])
    expect(keys(rows[0]?.teammates ?? [])).toEqual([keyOf(2, '-other')])
  })

  it('keeps a teammate whose lead is not listed top-level and names the lead folder', () => {
    const mate = testSession(2, {
      role: testAgentRole('a', 't'),
      team: testTeammateTeam(testRef(9, '-lead-folder'))
    })

    const rows = groupSessionRows([mate], testSessionsT)

    expect(rows[0]?.leadFolder).toBe('-lead-folder')
  })

  it('keeps an ungrouped teammate top-level with no lead folder', () => {
    const mate = testSession(2, {
      role: testAgentRole('a', 't'),
      team: { kind: 'ungrouped', teamName: 'team' }
    })

    const rows = groupSessionRows([mate], testSessionsT)

    expect(keys(rows)).toEqual([keyOf(2)])
    expect(rows[0]?.leadFolder).toBeNull()
  })

  it('never renders a teammate both nested and top-level, even when two leads list it', () => {
    const leadA = testSession(1, { latestMs: 9, team: testLeadTeam([testRef(3)]) })
    const leadB = testSession(2, { latestMs: 8, team: testLeadTeam([testRef(3)]) })
    const mate = testSession(3, { team: testTeammateTeam(testRef(1)) })

    const rows = groupSessionRows([leadA, leadB, mate], testSessionsT)

    const all = rows.flatMap((row) => [row.key, ...row.teammates.map((t) => t.key)])
    expect(all.filter((key) => key === keyOf(3))).toHaveLength(1)
  })

  it('drops a teammate reference that is not in the list', () => {
    const lead = testSession(1, { team: testLeadTeam([testRef(7)]) })

    expect(groupSessionRows([lead], testSessionsT)[0]?.teammates).toEqual([])
  })

  it('keeps a lead top-level even when another lead lists it', () => {
    const leadA = testSession(1, { team: testLeadTeam([testRef(2)]) })
    const leadB = testSession(2, { team: testLeadTeam([]) })

    expect(keys(groupSessionRows([leadA, leadB], testSessionsT)).sort()).toEqual([
      keyOf(1),
      keyOf(2)
    ])
  })

  it('keeps only the first of two items with the same folder and id', () => {
    const first = testSession(1, { title: 'first' })
    const second = testSession(1, { title: 'second' })

    const rows = groupSessionRows([first, second], testSessionsT)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.item).toBe(first)
  })

  it('sorts by last active, newest first, using modified time when there is no activity', () => {
    const old = testSession(1, { latestMs: 100 })
    const fresh = testSession(2, { latestMs: 300 })
    const modifiedOnly = testSession(3, { modifiedMs: 200 })

    expect(keys(groupSessionRows([old, fresh, modifiedOnly], testSessionsT))).toEqual([
      keyOf(2),
      keyOf(3),
      keyOf(1)
    ])
  })

  it('sorts sessions with no time last, then by key for a stable order', () => {
    const timed = testSession(5, { latestMs: 1 })
    const noTimeB = testSession(3)
    const noTimeA = testSession(2)

    expect(keys(groupSessionRows([noTimeB, timed, noTimeA], testSessionsT))).toEqual([
      keyOf(5),
      keyOf(2),
      keyOf(3)
    ])
  })
})
