import { describe, expect, it } from 'vitest'
import { groupSessionRows } from '@renderer/features/sessions/groupSessionRows'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '@renderer/features/sessions/testSessionFixtures'
import { testSessionsT } from '@renderer/features/sessions/testSessionsT'
import { findSessionRow } from '../findSessionRow'

const lead = testSession(1, { title: 'lead', team: testLeadTeam([testRef(2)]) })
const mate = testSession(2, {
  role: testAgentRole('writer', 'code'),
  team: testTeammateTeam(testRef(1))
})
const solo = testSession(3, { title: 'solo' })
const rows = groupSessionRows([lead, mate, solo], testSessionsT)

describe('findSessionRow', () => {
  it('finds a top-level row by folder and session id', () => {
    expect(findSessionRow(rows, testRef(3))?.item).toBe(solo)
  })

  it('finds a teammate nested under its lead', () => {
    const row = findSessionRow(rows, testRef(2))

    expect(row?.item).toBe(mate)
    expect(row?.teammates).toEqual([])
  })

  it('keeps the teammates of a lead row', () => {
    expect(findSessionRow(rows, testRef(1))?.teammates).toHaveLength(1)
  })

  it('does not match a session of the same id in another folder', () => {
    expect(findSessionRow(rows, testRef(3, '-other'))).toBeNull()
  })

  it('is null for a session that is not listed', () => {
    expect(findSessionRow(rows, testRef(9))).toBeNull()
  })
})
