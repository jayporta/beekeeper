import { describe, expect, it } from 'vitest'
import { cardFigures } from '../cardFigures'
import {
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../testSessionFixtures'

const NOTHING_RECORDED = {
  leadTokens: null,
  leadUSD: null,
  teamTokens: null,
  teamUSD: null
}

describe('cardFigures', () => {
  it("shows a solo session's own figures, not as a team total", () => {
    const item = testSession(1, { totalTokens: 7, costUSD: 0.5 })

    expect(cardFigures(item)).toEqual({
      figures: { tokens: 7, usd: 0.5, tokensPartial: false, usdPartial: false },
      teamTotal: false
    })
  })

  it("shows a teammate session's own figures, not as a team total", () => {
    const item = testSession(2, {
      team: testTeammateTeam(testRef(1)),
      totalTokens: 9,
      costUSD: 0.1
    })

    expect(cardFigures(item)).toMatchObject({ figures: { tokens: 9, usd: 0.1 }, teamTotal: false })
  })

  it("shows a lead's team figures as a team total", () => {
    const rollup = testUsage({ leadTokens: 20, teamTokens: 50, leadUSD: 2, teamUSD: 5 })
    const item = testSession(1, { team: testLeadTeam([testRef(2)], rollup) })

    expect(cardFigures(item)).toEqual({
      figures: { tokens: 50, usd: 5, tokensPartial: false, usdPartial: false },
      teamTotal: true
    })
  })

  it('keeps the team figures when the lead recorded nothing of its own but its teammates did', () => {
    const rollup = testUsage({ leadTokens: null, leadUSD: null, teamTokens: 300, teamUSD: 3 })
    const item = testSession(1, { team: testLeadTeam([testRef(2)], rollup) })

    expect(cardFigures(item)).toMatchObject({
      figures: { tokens: 300, usd: 3 },
      teamTotal: true
    })
  })

  it('keeps the team figures when the team recorded a cost but no tokens', () => {
    const rollup = testUsage({ ...NOTHING_RECORDED, teamUSD: 3 })
    const item = testSession(1, {
      team: testLeadTeam([testRef(2)], rollup),
      transcriptTokens: 1200
    })

    expect(cardFigures(item)).toMatchObject({ figures: { tokens: null, usd: 3 }, teamTotal: true })
  })

  it("falls back to a running lead's transcript tokens, not as a team total, when nothing was recorded", () => {
    const item = testSession(1, {
      team: testLeadTeam([testRef(2)], testUsage(NOTHING_RECORDED)),
      transcriptTokens: 1200,
      subagentCount: 2
    })

    expect(cardFigures(item)).toEqual({
      figures: { tokens: 1200, usd: null, tokensPartial: true, usdPartial: false },
      teamTotal: false
    })
  })

  it('has no figures for a lead whose team and transcript recorded nothing', () => {
    const item = testSession(1, {
      team: testLeadTeam([testRef(2)], testUsage(NOTHING_RECORDED))
    })

    expect(cardFigures(item)).toEqual({ figures: null, teamTotal: false })
  })

  it('has no figures for a session that recorded neither tokens nor cost', () => {
    expect(cardFigures(testSession(1))).toEqual({ figures: null, teamTotal: false })
  })

  it("shows a session's transcript tokens, marked partial, when it recorded none", () => {
    const item = testSession(1, { transcriptTokens: 1200, subagentCount: 3 })

    expect(cardFigures(item)).toEqual({
      figures: { tokens: 1200, usd: null, tokensPartial: true, usdPartial: false },
      teamTotal: false
    })
  })

  it('has no figures when the summary could not be read', () => {
    expect(cardFigures(testSession(1, { unreadable: true }))).toEqual({
      figures: null,
      teamTotal: false
    })
  })

  it('keeps cost-only figures', () => {
    expect(cardFigures(testSession(1, { costUSD: 0.004 })).figures).toMatchObject({
      tokens: null,
      usd: 0.004
    })
  })
})
