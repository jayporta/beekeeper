import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionScanDir, type SessionScanDir } from '../../session/testSessionDir'
import { buildAssistantRecord, buildJsonlText } from '../../transcript/testFixtures'
import { scanSessionDailyUsage } from '../scanSessionDailyUsage'

/** The UTC date of an instant stands in for the local day, so tests don't depend on the host zone. */
const dayKeyOf = (epochMs: number): string => new Date(epochMs).toISOString().slice(0, 10)

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

describe('scanSessionDailyUsage', () => {
  it('buckets a lead and a subagent on different days separately', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({
          messageId: 'lead_1',
          inputTokens: 10,
          outputTokens: 0,
          timestamp: '2026-01-01T12:00:00Z'
        })
      ])
    )
    const subagent = dir.addSubagent('a1', {
      transcript: buildJsonlText([
        buildAssistantRecord({
          messageId: 'sub_1',
          inputTokens: 4,
          outputTokens: 0,
          timestamp: '2026-01-02T12:00:00Z'
        })
      ])
    })

    const usage = await scanSessionDailyUsage({ leadPath, subagents: [subagent], dayKeyOf })

    expect(usage.buckets).toEqual([
      { day: '2026-01-01', model: 'claude-opus-5', tokens: 10 },
      { day: '2026-01-02', model: 'claude-opus-5', tokens: 4 }
    ])
  })

  it("counts a message a subagent repeats from the lead's context once", async () => {
    const shared = buildAssistantRecord({
      messageId: 'msg_shared',
      inputTokens: 10,
      outputTokens: 0
    })
    const leadPath = dir.writeLead(buildJsonlText([shared]))
    const subagent = dir.addSubagent('a1', { transcript: buildJsonlText([shared]) })

    const usage = await scanSessionDailyUsage({ leadPath, subagents: [subagent], dayKeyOf })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: 'claude-opus-5', tokens: 10 }])
  })

  it('puts a message reported in two records on the day of its earliest record', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_1',
          inputTokens: 10,
          outputTokens: 0,
          timestamp: '2026-01-02T00:01:00Z'
        }),
        buildAssistantRecord({
          messageId: 'msg_1',
          inputTokens: 10,
          outputTokens: 0,
          timestamp: '2026-01-01T23:59:00Z'
        })
      ])
    )

    const usage = await scanSessionDailyUsage({ leadPath, subagents: [], dayKeyOf })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: 'claude-opus-5', tokens: 10 }])
  })

  it('counts an unreadable subagent and still counts the lead', async () => {
    const leadPath = dir.writeLead(buildJsonlText([buildAssistantRecord({ messageId: 'lead_1' })]))

    const usage = await scanSessionDailyUsage({
      leadPath,
      subagents: [dir.missingSubagent('gone')],
      dayKeyOf
    })

    expect(usage.unreadableSubagents).toBe(1)
    expect(usage.buckets).toHaveLength(1)
  })

  it('counts a malformed line as skipped', async () => {
    const leadPath = dir.writeLead(
      `not json\n${buildJsonlText([buildAssistantRecord({ messageId: 'lead_1' })])}`
    )

    const usage = await scanSessionDailyUsage({ leadPath, subagents: [], dayKeyOf })

    expect(usage.skippedLines).toBe(1)
    expect(usage.buckets).toHaveLength(1)
  })

  it('counts a skipped line in a subagent transcript', async () => {
    const leadPath = dir.writeLead('')
    const subagent = dir.addSubagent('a1', { transcript: 'not json\n' })

    const usage = await scanSessionDailyUsage({ leadPath, subagents: [subagent], dayKeyOf })

    expect(usage.skippedLines).toBe(1)
  })

  it('reports empty usage for an empty lead transcript', async () => {
    const leadPath = dir.writeLead('')

    const usage = await scanSessionDailyUsage({ leadPath, subagents: [], dayKeyOf })

    expect(usage).toEqual({
      buckets: [],
      undatedMessages: 0,
      skippedLines: 0,
      unreadableSubagents: 0
    })
  })

  it('rejects when the lead transcript cannot be read', async () => {
    const leadPath = `${dir.writeLead('')}.missing`

    await expect(scanSessionDailyUsage({ leadPath, subagents: [], dayKeyOf })).rejects.toThrow()
  })
})
