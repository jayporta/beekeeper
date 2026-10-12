import { describe, expect, it } from 'vitest'
import { QUARTER_HOUR_MS } from '../../../core/shared/quarterHour'
import { combineDailyUsage } from '../../../core/usage/combineDailyUsage'
import { EMPTY_SUBAGENT_DAILY_USAGE } from '../../../core/usage/scanSubagentDailyUsage'
import { EMPTY_LEAD_USAGE } from '../../../core/transcript/summary/testSessionSummary'
import { createDayKeyOf } from '../localDayKey'

const MODEL = 'claude-opus-5'

/** The day a lead message at `iso` lands on after its slot goes through `combineDailyUsage`. */
function slotDay(iso: string, timeZone: string): string | undefined {
  const slot = Math.floor(Date.parse(iso) / QUARTER_HOUR_MS)
  const usage = combineDailyUsage({
    lead: { ...EMPTY_LEAD_USAGE, slots: [{ slot, model: MODEL, tokens: 1 }] },
    leadSkippedLines: 0,
    subagents: EMPTY_SUBAGENT_DAILY_USAGE,
    dayKeyOf: createDayKeyOf(timeZone)
  })
  return usage.buckets[0]?.day
}

interface SlotCase {
  readonly label: string
  readonly timeZone: string
  readonly iso: string
  readonly day: string
}

const cases: readonly SlotCase[] = [
  // America/New_York springs forward at 02:00 local (07:00Z) on 2026-03-08.
  {
    label: '01:45 before the spring forward',
    timeZone: 'America/New_York',
    iso: '2026-03-08T06:45:00Z',
    day: '2026-03-08'
  },
  {
    label: '03:00 after the spring forward',
    timeZone: 'America/New_York',
    iso: '2026-03-08T07:00:00Z',
    day: '2026-03-08'
  },
  // America/New_York falls back at 02:00 EDT (06:00Z) on 2026-11-01, repeating 01:00 to 02:00.
  {
    label: 'the first 01:30 of the repeated hour',
    timeZone: 'America/New_York',
    iso: '2026-11-01T05:30:00Z',
    day: '2026-11-01'
  },
  {
    label: 'the second 01:30 of the repeated hour',
    timeZone: 'America/New_York',
    iso: '2026-11-01T06:30:00Z',
    day: '2026-11-01'
  },
  {
    label: '23:45 the day before the fall back',
    timeZone: 'America/New_York',
    iso: '2026-11-01T03:45:00Z',
    day: '2026-10-31'
  },
  {
    label: '00:00 on the day of the fall back',
    timeZone: 'America/New_York',
    iso: '2026-11-01T04:00:00Z',
    day: '2026-11-01'
  },
  // Asia/Kathmandu is UTC+5:45.
  {
    label: '23:45 in Kathmandu',
    timeZone: 'Asia/Kathmandu',
    iso: '2026-01-01T18:00:00Z',
    day: '2026-01-01'
  },
  {
    label: '00:00 in Kathmandu',
    timeZone: 'Asia/Kathmandu',
    iso: '2026-01-01T18:15:00Z',
    day: '2026-01-02'
  },
  // Australia/Eucla is UTC+8:45.
  {
    label: '23:45 in Eucla',
    timeZone: 'Australia/Eucla',
    iso: '2026-01-01T15:00:00Z',
    day: '2026-01-01'
  },
  {
    label: '00:00 in Eucla',
    timeZone: 'Australia/Eucla',
    iso: '2026-01-01T15:15:00Z',
    day: '2026-01-02'
  },
  // Pacific/Chatham is UTC+12:45 in standard time and UTC+13:45 in daylight time.
  {
    label: '23:45 in Chatham standard time',
    timeZone: 'Pacific/Chatham',
    iso: '2026-06-15T11:00:00Z',
    day: '2026-06-15'
  },
  {
    label: '00:00 in Chatham standard time',
    timeZone: 'Pacific/Chatham',
    iso: '2026-06-15T11:15:00Z',
    day: '2026-06-16'
  },
  {
    label: '23:45 in Chatham daylight time',
    timeZone: 'Pacific/Chatham',
    iso: '2026-01-15T10:00:00Z',
    day: '2026-01-15'
  },
  {
    label: '00:00 in Chatham daylight time',
    timeZone: 'Pacific/Chatham',
    iso: '2026-01-15T10:15:00Z',
    day: '2026-01-16'
  }
]

describe('a lead slot mapped to a local day', () => {
  it.each(cases)('puts $label on $day in $timeZone', ({ iso, timeZone, day }) => {
    expect(slotDay(iso, timeZone)).toBe(day)
  })

  it.each(cases)(
    'puts the last millisecond of the slot of $label on the same day in $timeZone',
    ({ iso, timeZone }) => {
      const slotEnd =
        Math.floor(Date.parse(iso) / QUARTER_HOUR_MS) * QUARTER_HOUR_MS + QUARTER_HOUR_MS - 1

      expect(slotDay(iso, timeZone)).toBe(createDayKeyOf(timeZone)(slotEnd))
    }
  )
})
