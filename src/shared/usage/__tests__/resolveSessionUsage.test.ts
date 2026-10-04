import { describe, expect, it } from 'vitest'
import { resolveSessionUsage, type SessionUsageInput } from '../resolveSessionUsage'

const input = (overrides: Partial<SessionUsageInput> = {}): SessionUsageInput => ({
  recordedTokens: null,
  recordedUsd: null,
  transcriptTokens: null,
  subagentCount: 0,
  ...overrides
})

describe('resolveSessionUsage', () => {
  it('uses the recorded totals when the session recorded tokens', () => {
    expect(
      resolveSessionUsage(input({ recordedTokens: 100, recordedUsd: 2.5, transcriptTokens: 7 }))
    ).toEqual({ tokens: 100, usd: 2.5, tokensPartial: false })
  })

  it('keeps a recorded token total of zero rather than falling back', () => {
    expect(resolveSessionUsage(input({ recordedTokens: 0, transcriptTokens: 50 }))).toMatchObject({
      tokens: 0
    })
  })

  it('falls back to the transcript’s tokens when none were recorded, with no cost', () => {
    expect(resolveSessionUsage(input({ transcriptTokens: 40, recordedUsd: null }))).toEqual({
      tokens: 40,
      usd: null,
      tokensPartial: false
    })
  })

  it('marks the fallback partial when the session has subagents, whose tokens it leaves out', () => {
    expect(resolveSessionUsage(input({ transcriptTokens: 40, subagentCount: 2 }))).toMatchObject({
      tokens: 40,
      tokensPartial: true
    })
  })

  it('marks the fallback partial when the number of subagents is unknown', () => {
    expect(resolveSessionUsage(input({ transcriptTokens: 40, subagentCount: null }))).toMatchObject(
      { tokensPartial: true }
    )
  })

  it('does not mark a recorded total partial, whatever the subagent count', () => {
    expect(
      resolveSessionUsage(input({ recordedTokens: 9, transcriptTokens: 5, subagentCount: null }))
    ).toMatchObject({ tokensPartial: false })
  })

  it('does not mark a missing figure partial because the session has subagents', () => {
    expect(resolveSessionUsage(input({ subagentCount: 3 }))).toEqual({
      tokens: null,
      usd: null,
      tokensPartial: false
    })
  })

  it('has no tokens when neither was recorded nor read from the transcript', () => {
    expect(resolveSessionUsage(input())).toEqual({ tokens: null, usd: null, tokensPartial: false })
  })

  it('keeps a recorded cost with no recorded tokens', () => {
    expect(resolveSessionUsage(input({ recordedUsd: 3 }))).toMatchObject({ usd: 3 })
  })
})
