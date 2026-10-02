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

  describe('without a recorded token total', () => {
    it('shows the transcript total, not partial, when the session has no subagents', () => {
      const item = testSession(1, { transcriptTokens: 500, subagentCount: 0 })

      expect(sessionUsage(item).session).toEqual({
        tokens: 500,
        usd: null,
        tokensPartial: false,
        usdPartial: false
      })
    })

    it('marks the transcript total partial when the session has subagents', () => {
      const item = testSession(1, { transcriptTokens: 500, subagentCount: 2 })

      expect(sessionUsage(item).session.tokensPartial).toBe(true)
    })

    it('marks the transcript total partial when the subagent count is unknown', () => {
      const item = testSession(1, { transcriptTokens: 500, subagentCount: null })

      expect(sessionUsage(item).session.tokensPartial).toBe(true)
    })

    it('reports no tokens when the transcript has no total either', () => {
      const item = testSession(1, { transcriptTokens: null, subagentCount: 0 })

      expect(sessionUsage(item).session.tokens).toBeNull()
    })

    it('keeps the cost empty when the recorded cost is missing', () => {
      const item = testSession(1, { transcriptTokens: 500, subagentCount: 2 })

      expect(sessionUsage(item).session).toMatchObject({ usd: null, usdPartial: false })
    })

    it('uses the transcript total when a cost was recorded without a token total', () => {
      const item = testSession(1, { costUSD: 0.5, transcriptTokens: 500 })

      expect(sessionUsage(item).session).toEqual({
        tokens: 500,
        usd: 0.5,
        tokensPartial: false,
        usdPartial: false
      })
    })

    it('shows the transcript total for a lead whose roll-up has no lead tokens, team unchanged', () => {
      const rollup = testUsage({ leadTokens: null, teamTokens: 300, sessionsWithoutTokens: 1 })
      const item = testSession(1, {
        transcriptTokens: 500,
        subagentCount: 0,
        team: testLeadTeam([], rollup)
      })

      expect(sessionUsage(item)).toMatchObject({
        session: { tokens: 500, tokensPartial: false },
        team: { tokens: 300, tokensPartial: true }
      })
    })

    it("marks a lead's transcript total partial when it has subagents", () => {
      const item = testSession(1, {
        transcriptTokens: 500,
        subagentCount: 3,
        team: testLeadTeam([], testUsage({ leadTokens: null }))
      })

      expect(sessionUsage(item).session.tokensPartial).toBe(true)
    })
  })

  describe('with a recorded token total', () => {
    it('prefers the recorded total to the transcript total, not partial', () => {
      const item = testSession(1, { totalTokens: 7, transcriptTokens: 500, subagentCount: 2 })

      expect(sessionUsage(item).session).toMatchObject({ tokens: 7, tokensPartial: false })
    })

    it("prefers a lead's recorded roll-up total to the transcript total", () => {
      const item = testSession(1, {
        transcriptTokens: 500,
        subagentCount: 2,
        team: testLeadTeam([], testUsage({ leadTokens: 20 }))
      })

      expect(sessionUsage(item).session).toMatchObject({ tokens: 20, tokensPartial: false })
    })
  })
})
