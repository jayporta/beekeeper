import { describe, expect, it } from 'vitest'
import type { DailyUsageBucket, SessionDailyUsage } from '../../../core/usage/dailyUsage'
import { folderDailyUsage, type SessionDailyOutcome } from '../folderDailyUsage'

const DAYS = ['2026-01-01', '2026-01-02', '2026-01-03']

function readable(usage: Partial<SessionDailyUsage>, subagentsListed = true): SessionDailyOutcome {
  return {
    ok: true,
    subagentsListed,
    usage: {
      buckets: [],
      undatedMessages: 0,
      skippedLines: 0,
      unreadableSubagents: 0,
      ...usage
    }
  }
}

const bucket = (day: string, model: string, tokens: number): DailyUsageBucket => ({
  day,
  model,
  tokens
})

const inWindow = bucket('2026-01-02', 'm', 1)

describe('folderDailyUsage', () => {
  it('lists every day of the window, oldest first, with no models on a quiet day', () => {
    const dto = folderDailyUsage({
      days: DAYS,
      sessions: [readable({ buckets: [bucket('2026-01-02', 'm', 5)] })]
    })

    expect(dto.days).toEqual([
      { day: '2026-01-01', models: [] },
      { day: '2026-01-02', models: [{ model: 'm', tokens: 5 }] },
      { day: '2026-01-03', models: [] }
    ])
  })

  it('leaves out buckets of days outside the window', () => {
    const dto = folderDailyUsage({
      days: DAYS,
      sessions: [
        readable({ buckets: [bucket('2025-12-31', 'm', 9), bucket('2026-01-04', 'm', 9)] })
      ]
    })

    expect(dto.days.every((day) => day.models.length === 0)).toBe(true)
  })

  it('sums the same day and model across sessions', () => {
    const dto = folderDailyUsage({
      days: DAYS,
      sessions: [
        readable({ buckets: [bucket('2026-01-01', 'm', 5)] }),
        readable({ buckets: [bucket('2026-01-01', 'm', 7)] })
      ]
    })

    expect(dto.days[0]?.models).toEqual([{ model: 'm', tokens: 12 }])
  })

  it('sorts a day’s models largest first, with ties by model id', () => {
    const dto = folderDailyUsage({
      days: DAYS,
      sessions: [
        readable({
          buckets: [
            bucket('2026-01-01', 'b', 5),
            bucket('2026-01-01', 'c', 9),
            bucket('2026-01-01', 'a', 5)
          ]
        })
      ]
    })

    expect(dto.days[0]?.models.map((m) => m.model)).toEqual(['c', 'a', 'b'])
  })

  it('counts each partial reason once per session', () => {
    const dto = folderDailyUsage({
      days: DAYS,
      sessions: [
        { ok: false },
        { ok: false },
        readable({ skippedLines: 4, buckets: [inWindow] }),
        readable({ undatedMessages: 2, buckets: [inWindow] }),
        readable({ unreadableSubagents: 3 }),
        readable({}, false),
        readable(
          { skippedLines: 1, undatedMessages: 1, unreadableSubagents: 1, buckets: [inWindow] },
          false
        ),
        readable({})
      ]
    })

    expect(dto.partial).toEqual({
      unreadable: 2,
      skippedLines: 2,
      undated: 2,
      unreadableSubagents: 3
    })
  })

  it('counts no unreadable lines or undated messages for a session with nothing in the window', () => {
    const dto = folderDailyUsage({
      days: DAYS,
      sessions: [
        readable({ skippedLines: 2, undatedMessages: 1, buckets: [bucket('2025-12-31', 'm', 5)] })
      ]
    })

    expect(dto.partial).toEqual({
      unreadable: 0,
      skippedLines: 0,
      undated: 0,
      unreadableSubagents: 0
    })
  })

  it('has no models and no partial counts for no sessions', () => {
    expect(folderDailyUsage({ days: DAYS, sessions: [] })).toEqual({
      days: DAYS.map((day) => ({ day, models: [] })),
      partial: { unreadable: 0, skippedLines: 0, undated: 0, unreadableSubagents: 0 }
    })
  })
})
