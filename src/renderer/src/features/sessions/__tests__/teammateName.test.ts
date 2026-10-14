import { describe, expect, it } from 'vitest'
import type { SessionRoleDto } from '../../../../../shared/ipc/sessionRoleDto'
import { teammateName } from '../teammateName'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testSessionId,
  testTeammateTeam
} from '../../../../../shared/sessions/testSessionFixtures'
import { testRow } from '../../../../../shared/sessions/testSessionRows'

/** The name parts of teammate session 2 with this role, under lead 1. */
function nameOf(role: SessionRoleDto): ReturnType<typeof teammateName> {
  const lead = testSession(1, { team: testLeadTeam([testRef(2)]) })
  const mate = testSession(2, { role, team: testTeammateTeam(testRef(1)) })
  const teammate = testRow(1, [lead, mate]).teammates[0]
  if (teammate === undefined) throw new Error('not grouped')
  return teammateName(teammate)
}

describe('teammateName', () => {
  it('names a teammate by its agent name, with its type beside it', () => {
    expect(nameOf(testAgentRole('reviewer', 'code'))).toEqual({ name: 'reviewer', type: 'code' })
  })

  it('names a teammate with no name by its type, leaving the type column empty', () => {
    expect(nameOf(testAgentRole(null, 'code'))).toEqual({ name: 'code', type: null })
  })

  it('names a teammate with a name and no type by its name alone', () => {
    expect(nameOf(testAgentRole('reviewer', null))).toEqual({ name: 'reviewer', type: null })
  })

  it('names a teammate with neither by its short id', () => {
    expect(nameOf(testAgentRole(null, null))).toEqual({
      name: testSessionId(2).slice(0, 8),
      type: null
    })
  })
})
