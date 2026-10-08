import { describe, expect, it } from 'vitest'
import { QUARTER_HOUR_MS } from '../../shared/quarterHour'
import type { LeadUsage } from '../../transcript/summary/leadUsage'
import { EMPTY_LEAD_USAGE } from '../../transcript/summary/testSessionSummary'
import { combineDailyUsage } from '../combineDailyUsage'
import type { SessionDailyUsage } from '../dailyUsage'
import { EMPTY_SUBAGENT_DAILY_USAGE } from '../scanSubagentDailyUsage'

const dayKeyOf = (epochMs: number): string => new Date(epochMs).toISOString().slice(0, 10)
const slotOf = (iso: string): number => Math.floor(Date.parse(iso) / QUARTER_HOUR_MS)
const MODEL = 'claude-opus-5'

const lead = (overrides: Partial<LeadUsage>): LeadUsage => ({ ...EMPTY_LEAD_USAGE, ...overrides })
const subagents = (overrides: Partial<SessionDailyUsage>): SessionDailyUsage => ({
  ...EMPTY_SUBAGENT_DAILY_USAGE,
  ...overrides
})

describe('combineDailyUsage', () => {
  it('sums a lead slot and a subagent bucket on the same day and model', () => {
    const usage = combineDailyUsage({
      lead: lead({ slots: [{ slot: slotOf('2026-01-01T12:00:00Z'), model: MODEL, tokens: 10 }] }),
      leadSkippedLines: 0,
      subagents: subagents({ buckets: [{ day: '2026-01-01', model: MODEL, tokens: 4 }] }),
      dayKeyOf
    })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: MODEL, tokens: 14 }])
  })

  it('merges lead slots in different slots of one local day', () => {
    const usage = combineDailyUsage({
      lead: lead({
        slots: [
          { slot: slotOf('2026-01-01T01:00:00Z'), model: MODEL, tokens: 3 },
          { slot: slotOf('2026-01-01T23:45:00Z'), model: MODEL, tokens: 5 }
        ]
      }),
      leadSkippedLines: 0,
      subagents: EMPTY_SUBAGENT_DAILY_USAGE,
      dayKeyOf
    })

    expect(usage.buckets).toEqual([{ day: '2026-01-01', model: MODEL, tokens: 8 }])
  })

  it('sorts the buckets by day then model', () => {
    const usage = combineDailyUsage({
      lead: lead({
        slots: [
          { slot: slotOf('2026-01-02T00:00:00Z'), model: 'a-model', tokens: 1 },
          { slot: slotOf('2026-01-01T00:00:00Z'), model: 'z-model', tokens: 1 }
        ]
      }),
      leadSkippedLines: 0,
      subagents: subagents({ buckets: [{ day: '2026-01-01', model: 'b-model', tokens: 1 }] }),
      dayKeyOf
    })

    expect(usage.buckets.map((b) => `${b.day} ${b.model}`)).toEqual([
      '2026-01-01 b-model',
      '2026-01-01 z-model',
      '2026-01-02 a-model'
    ])
  })

  it('adds the lead and subagent undated messages', () => {
    const usage = combineDailyUsage({
      lead: lead({ undatedMessages: 2 }),
      leadSkippedLines: 0,
      subagents: subagents({ undatedMessages: 3 }),
      dayKeyOf
    })

    expect(usage.undatedMessages).toBe(5)
  })

  it('adds the lead summary skipped lines, its invalid assistant records and the subagents skipped lines', () => {
    const usage = combineDailyUsage({
      lead: lead({ invalidAssistantRecords: 2 }),
      leadSkippedLines: 1,
      subagents: subagents({ skippedLines: 4 }),
      dayKeyOf
    })

    expect(usage.skippedLines).toBe(7)
  })

  it('reports the unreadable subagents', () => {
    const usage = combineDailyUsage({
      lead: EMPTY_LEAD_USAGE,
      leadSkippedLines: 0,
      subagents: subagents({ unreadableSubagents: 2 }),
      dayKeyOf
    })

    expect(usage.unreadableSubagents).toBe(2)
  })
})
