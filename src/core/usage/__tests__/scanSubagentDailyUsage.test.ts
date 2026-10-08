import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionScanDir, type SessionScanDir } from '../../session/testSessionDir'
import { buildAssistantRecord, buildJsonlText } from '../../transcript/testFixtures'
import { EMPTY_SUBAGENT_DAILY_USAGE, scanSubagentDailyUsage } from '../scanSubagentDailyUsage'

/** The UTC date of an instant stands in for the local day, so tests don't depend on the host zone. */
const dayKeyOf = (epochMs: number): string => new Date(epochMs).toISOString().slice(0, 10)

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

describe('scanSubagentDailyUsage', () => {
  it('buckets a subagent message on its day', async () => {
    const subagent = dir.addSubagent('a1', {
      transcript: buildJsonlText([
        buildAssistantRecord({ messageId: 'sub_1', inputTokens: 4, outputTokens: 0 })
      ])
    })

    const usage = await scanSubagentDailyUsage({
      subagents: [subagent],
      leadMessageIds: new Set(),
      dayKeyOf
    })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: 'claude-opus-5', tokens: 4 }])
  })

  it('leaves out a message whose id the lead reported', async () => {
    const subagent = dir.addSubagent('a1', {
      transcript: buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_lead', inputTokens: 10, outputTokens: 0 }),
        buildAssistantRecord({ messageId: 'msg_own', inputTokens: 3, outputTokens: 0 })
      ])
    })

    const usage = await scanSubagentDailyUsage({
      subagents: [subagent],
      leadMessageIds: new Set(['msg_lead']),
      dayKeyOf
    })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: 'claude-opus-5', tokens: 3 }])
  })

  it('ignores a lead-owned id even when the lead did not count the message, so the subagent copy is not counted either', async () => {
    const subagent = dir.addSubagent('a1', {
      transcript: buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_synthetic_in_lead', inputTokens: 10 })
      ])
    })

    const usage = await scanSubagentDailyUsage({
      subagents: [subagent],
      leadMessageIds: new Set(['msg_synthetic_in_lead']),
      dayKeyOf
    })

    expect(usage).toEqual(EMPTY_SUBAGENT_DAILY_USAGE)
  })

  it('gives a message two subagents report to the earlier agent in the given order, on its day', async () => {
    const first = dir.addSubagent('a1', {
      transcript: buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_x',
          inputTokens: 10,
          outputTokens: 0,
          timestamp: '2026-01-01T12:00:00Z'
        })
      ])
    })
    const second = dir.addSubagent('a2', {
      transcript: buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_x',
          inputTokens: 10,
          outputTokens: 0,
          timestamp: '2026-01-03T12:00:00Z'
        })
      ])
    })

    const usage = await scanSubagentDailyUsage({
      subagents: [first, second],
      leadMessageIds: new Set(),
      dayKeyOf
    })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: 'claude-opus-5', tokens: 10 }])
  })

  it('counts a subagent that cannot be read and keeps the others', async () => {
    const readable = dir.addSubagent('a1', {
      transcript: buildJsonlText([
        buildAssistantRecord({ messageId: 'sub_1', inputTokens: 4, outputTokens: 0 })
      ])
    })

    const usage = await scanSubagentDailyUsage({
      subagents: [dir.missingSubagent('a2'), readable],
      leadMessageIds: new Set(),
      dayKeyOf
    })

    expect(usage.unreadableSubagents).toBe(1)
    expect(usage.buckets).toHaveLength(1)
  })

  it('counts an invalid line in a subagent transcript as skipped', async () => {
    const subagent = dir.addSubagent('a1', { transcript: `${buildJsonlText([])}not json\n` })

    const usage = await scanSubagentDailyUsage({
      subagents: [subagent],
      leadMessageIds: new Set(),
      dayKeyOf
    })

    expect(usage.skippedLines).toBe(1)
  })

  it('reports nothing for a session with no subagents', async () => {
    const usage = await scanSubagentDailyUsage({
      subagents: [],
      leadMessageIds: new Set(),
      dayKeyOf
    })

    expect(usage).toEqual(EMPTY_SUBAGENT_DAILY_USAGE)
  })
})
