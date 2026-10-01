import { describe, expect, it } from 'vitest'
import { sessionUsage } from '../sessionUsage'
import { testLeadTeam, testSession, testUsage } from '../testSessionFixtures'

const NOTHING = { tokens: null, usd: null, tokensPartial: false, usdPartial: false }

describe('sessionUsage', () => {
  it('reports a lead with a team by its own usage and the team roll-up', () => {
    const rollup = testUsage({ leadUSD: 2, teamUSD: 5, leadTokens: 20, teamTokens: 50 })
    const item = testSession(1, { team: testLeadTeam([], rollup) })

    expect(sessionUsage(item)).toEqual({
      session: { tokens: 20, usd: 2, tokensPartial: false, usdPartial: false },
      team: { tokens: 50, usd: 5, tokensPartial: false, usdPartial: false }
    })
  })

  it.each([
    ['a session with no cost', { sessionsWithoutCost: 1 }],
    ['a missing teammate', { missingTeammates: 1 }],
    ['a truncated list', { teamListsTruncated: true }]
  ])('marks the team cost partial for %s', (_label, overrides) => {
    const item = testSession(1, { team: testLeadTeam([], testUsage(overrides)) })

    expect(sessionUsage(item).team?.usdPartial).toBe(true)
  })

  it.each([
    ['a session with no tokens', { sessionsWithoutTokens: 1 }],
    ['a missing teammate', { missingTeammates: 1 }],
    ['a truncated list', { teamListsTruncated: true }]
  ])('marks the team tokens partial for %s', (_label, overrides) => {
    const item = testSession(1, { team: testLeadTeam([], testUsage(overrides)) })

    expect(sessionUsage(item).team?.tokensPartial).toBe(true)
  })

  it('marks only the tokens partial when a session has a cost but no token total', () => {
    const rollup = testUsage({ sessionsWithoutTokens: 1, sessionsWithoutCost: 0 })
    const item = testSession(1, { team: testLeadTeam([], rollup) })

    expect(sessionUsage(item).team).toMatchObject({ tokensPartial: true, usdPartial: false })
  })

  it('reports a session with no team by its own recorded usage and no team usage', () => {
    expect(sessionUsage(testSession(1, { costUSD: 0.5, totalTokens: 7 }))).toEqual({
      session: { tokens: 7, usd: 0.5, tokensPartial: false, usdPartial: false },
      team: null
    })
  })

  it('reports no usage for a session that recorded none', () => {
    expect(sessionUsage(testSession(1))).toEqual({ session: NOTHING, team: null })
  })

  it('reports no usage for an unreadable session', () => {
    expect(sessionUsage(testSession(1, { unreadable: true }))).toEqual({
      session: NOTHING,
      team: null
    })
  })
})
