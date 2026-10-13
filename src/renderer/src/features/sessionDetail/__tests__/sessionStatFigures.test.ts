import { describe, expect, it } from 'vitest'
import {
  testLeadTeam,
  testTeammateTeam,
  testRef,
  testSession,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import { sessionStats } from '../sessionStatFigures'
import { testDetail, testNode, testReport, testTokenGroup } from '../testSessionDetail'

const MIN = 60_000

describe('sessionStats tokens and cost', () => {
  it('gives a solo session its own tokens and cost', () => {
    const solo = testSession(1, { totalTokens: 1500, costUSD: 0.5 })

    const stats = sessionStats(testRow(1, [solo]), null)

    expect(stats.tokens).toEqual({ value: 1500, partial: false })
    expect(stats.usd).toEqual({ value: 0.5, partial: false })
  })

  it('gives a lead with a team the team total', () => {
    const lead = testSession(1, {
      team: testLeadTeam([testRef(2)], testUsage({ teamTokens: 900, teamUSD: 2 }))
    })
    const mate = testSession(2)

    expect(sessionStats(testRow(1, [lead, mate]), null).tokens?.value).toBe(900)
  })

  it('leaves out both when the session recorded neither', () => {
    const stats = sessionStats(testRow(1, [testSession(1, { unreadable: true })]), null)

    expect(stats.tokens).toBeNull()
    expect(stats.usd).toBeNull()
  })

  it('marks both and says why when transcript lines were skipped', () => {
    const solo = testSession(1, { totalTokens: 5, costUSD: 1, skippedLines: 2 })

    const stats = sessionStats(testRow(1, [solo]), null)

    expect(stats.tokens?.partial).toBe(true)
    expect(stats.usd?.partial).toBe(true)
    expect(stats.reasons.has('unreadableLines')).toBe(true)
  })
})

describe('sessionStats cache hit', () => {
  const row = testRow(1, [testSession(1)])

  it('is null without a detail', () => {
    expect(sessionStats(row, null).cacheHit).toBeNull()
  })

  it('is null when no input was read', () => {
    expect(sessionStats(row, testDetail()).cacheHit).toBeNull()
  })

  it('divides cache reads by input, reads and both cache write windows', () => {
    const lead = testReport({
      tokenGroups: [
        testTokenGroup({ input: 100, cacheRead: 300, cacheWrite5m: 50, cacheWrite1h: 50 })
      ]
    })

    expect(sessionStats(row, testDetail({ lead })).cacheHit).toEqual({ value: 0.6, partial: false })
  })

  it('sums the lead and every readable subagent', () => {
    const detail = testDetail({
      lead: testReport({ tokenGroups: [testTokenGroup({ input: 100 })] }),
      children: [testNode('a')],
      reports: { a: testReport({ tokenGroups: [testTokenGroup({ cacheRead: 100 })] }) }
    })

    expect(sessionStats(row, detail).cacheHit?.value).toBe(0.5)
  })

  it('is partial when a subagent report could not be read', () => {
    const detail = testDetail({
      lead: testReport({ tokenGroups: [testTokenGroup({ input: 1 })] }),
      children: [testNode('a')],
      reports: { a: 'error' }
    })

    const stats = sessionStats(row, detail)

    expect(stats.cacheHit?.partial).toBe(true)
    expect(stats.reasons.has('unreadableLines')).toBe(true)
  })

  it('is partial when the subagents folder could not be read', () => {
    const detail = testDetail({
      lead: testReport({ tokenGroups: [testTokenGroup({ input: 1 })] }),
      reports: false
    })

    expect(sessionStats(row, detail).cacheHit?.partial).toBe(true)
  })
})

describe('sessionStats duration, agents and tool errors', () => {
  it('measures the span of the session’s messages', () => {
    const solo = testSession(1, { earliestMs: 0, latestMs: 5 * MIN })

    expect(sessionStats(testRow(1, [solo]), null).durationMs).toBe(5 * MIN)
  })

  it('is null without timestamps', () => {
    expect(sessionStats(testRow(1, [testSession(1)]), null).durationMs).toBeNull()
  })

  it('counts the session, its subagents, and each teammate with its own subagents', () => {
    const lead = testSession(1, { subagentCount: 3, team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      subagentCount: 1,
      team: testTeammateTeam(testRef(1))
    })

    expect(sessionStats(testRow(1, [lead, mate]), null).agents).toEqual({
      value: 6,
      partial: false
    })
  })

  it('is partial when a subagent count is unknown', () => {
    const solo = testSession(1, { subagentCount: null })

    expect(sessionStats(testRow(1, [solo]), null).agents).toEqual({ value: 1, partial: true })
  })

  it('counts tool errors, marked when the signals are partial', () => {
    const solo = testSession(1, {
      signals: {
        ...testReport().signals,
        toolErrors: 4,
        partial: true
      }
    })

    const stats = sessionStats(testRow(1, [solo]), null)

    expect(stats.toolErrors).toEqual({ value: 4, partial: true })
    expect(stats.reasons.has('incompleteSignals')).toBe(true)
  })

  it('has no tool errors figure when the summary could not be read', () => {
    const stats = sessionStats(testRow(1, [testSession(1, { unreadable: true })]), null)

    expect(stats.toolErrors).toBeNull()
  })
})
