import { describe, expect, it } from 'vitest'
import { groupSessionRows } from '../../../../../shared/sessions/groupSessionRows'
import { largestTokens } from '../largestTokens'
import {
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../../../../../shared/sessions/testSessionFixtures'
import { testLabelWords } from '../testLabelWords'

const rowsOf = (
  ...items: Parameters<typeof groupSessionRows>[0]
): ReturnType<typeof groupSessionRows> => groupSessionRows(items, testLabelWords)

describe('largestTokens', () => {
  it('is 0 for no rows', () => {
    expect(largestTokens([])).toBe(0)
  })

  it('is 0 when no card shows tokens', () => {
    expect(largestTokens(rowsOf(testSession(1, { unreadable: true })))).toBe(0)
  })

  it('is the most tokens a session shows', () => {
    const rows = rowsOf(
      testSession(1, { totalTokens: 10 }),
      testSession(2, { totalTokens: 90 }),
      testSession(3, { totalTokens: 40 })
    )

    expect(largestTokens(rows)).toBe(90)
  })

  it("counts a lead's team total, not its own tokens", () => {
    const rows = rowsOf(
      testSession(1, {
        totalTokens: 10,
        team: testLeadTeam([testRef(2)], testUsage({ leadTokens: 10, teamTokens: 500 }))
      }),
      testSession(2, { totalTokens: 490, team: testTeammateTeam(testRef(1)) }),
      testSession(3, { totalTokens: 100 })
    )

    expect(largestTokens(rows)).toBe(500)
  })
})
