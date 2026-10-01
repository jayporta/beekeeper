import { describe, expect, it } from 'vitest'
import { sessionCosts } from '../sessionCosts'
import { testUsage, testLeadTeam, testSession } from '../testSessionFixtures'

describe('sessionCosts', () => {
  it('reports a lead with a team by the team roll-up', () => {
    const item = testSession(1, { team: testLeadTeam([], testUsage({ leadUSD: 2, teamUSD: 5 })) })

    expect(sessionCosts(item)).toEqual({ sessionUSD: 2, teamUSD: 5, partial: false })
  })

  it.each([
    ['a session with no cost', { sessionsWithoutCost: 1 }],
    ['a missing teammate', { missingTeammates: 1 }],
    ['a truncated list', { teamListsTruncated: true }]
  ])('marks the team cost partial for %s', (_label, overrides) => {
    const item = testSession(1, { team: testLeadTeam([], testUsage(overrides)) })

    expect(sessionCosts(item).partial).toBe(true)
  })

  it('reports a session with no team by its own recorded total and no team cost', () => {
    expect(sessionCosts(testSession(1, { costUSD: 0.5 }))).toEqual({
      sessionUSD: 0.5,
      teamUSD: null,
      partial: false
    })
  })

  it('reports no cost for a session that recorded none', () => {
    expect(sessionCosts(testSession(1)).sessionUSD).toBeNull()
  })

  it('reports no cost for an unreadable session', () => {
    expect(sessionCosts(testSession(1, { unreadable: true })).sessionUSD).toBeNull()
  })
})
