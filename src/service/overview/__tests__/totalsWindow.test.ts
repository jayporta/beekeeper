import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import { toAgentId } from '../../../core/transcript/ids'
import {
  SKIP_UNREAD_SLACK_MS,
  TOTALS_WINDOW_MS,
  isBeforeTotalsWindow,
  mayArchivedCountInWindow,
  mayArchivedHaveDailyUsage,
  mayCountInWindow,
  mayHaveDailyUsage
} from '../totalsWindow'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1000 * DAY
const window = { nowMs: NOW, windowMs: 7 * DAY }

const entryAt = (mtimeMs: number): Pick<SessionEntry, 'transcript'> => ({
  transcript: ok({ path: '/x.jsonl', mtimeMs, size: 1, ino: 1, dev: 1 })
})

describe('the totals windows', () => {
  it('are seven and thirty days long', () => {
    expect(TOTALS_WINDOW_MS).toEqual({ '7d': 7 * DAY, '30d': 30 * DAY })
  })

  it('leave a day of slack before a file is skipped unread', () => {
    expect(SKIP_UNREAD_SLACK_MS).toBe(DAY)
  })
})

describe('mayCountInWindow', () => {
  const start = NOW - window.windowMs

  it('keeps a transcript written inside the window', () => {
    expect(mayCountInWindow(entryAt(NOW), window)).toBe(true)
  })

  it('keeps a transcript written before the window by less than the slack, or exactly by it', () => {
    expect(mayCountInWindow(entryAt(start - SKIP_UNREAD_SLACK_MS + 1), window)).toBe(true)
    expect(mayCountInWindow(entryAt(start - SKIP_UNREAD_SLACK_MS), window)).toBe(true)
  })

  it('skips a transcript written before the window by more than the slack', () => {
    expect(mayCountInWindow(entryAt(start - SKIP_UNREAD_SLACK_MS - 1), window)).toBe(false)
  })

  it('keeps a transcript that could not be stat’d, to count it as unreadable', () => {
    expect(
      mayCountInWindow({ transcript: err({ reason: 'unreadable', code: 'EACCES' }) }, window)
    ).toBe(true)
  })
})

describe('mayHaveDailyUsage', () => {
  // The first day is at most a window plus a day back, so a file is read from there less the slack.
  const cutoff = NOW - window.windowMs - DAY - SKIP_UNREAD_SLACK_MS
  const subagentAt = (mtimeMs: number): SubagentEntry => ({
    agentId: toAgentId('a1'),
    transcript: { path: '/a1.jsonl', mtimeMs, size: 1, ino: 1, dev: 1 },
    metaPath: null,
    workflowRunId: null
  })
  const sessionAt = (
    leadMtimeMs: number,
    subagentMtimesMs: readonly number[] = []
  ): Pick<SessionEntry, 'transcript' | 'subagents'> => ({
    transcript: ok({ path: '/x.jsonl', mtimeMs: leadMtimeMs, size: 1, ino: 1, dev: 1 }),
    subagents: ok(subagentMtimesMs.map(subagentAt))
  })

  it('keeps a session whose lead file is exactly at the cutoff', () => {
    expect(mayHaveDailyUsage(sessionAt(cutoff), window)).toBe(true)
  })

  it('skips a session whose lead and subagent files are all older than the cutoff', () => {
    expect(mayHaveDailyUsage(sessionAt(cutoff - 1, [cutoff - 5]), window)).toBe(false)
  })

  it('keeps a session whose lead file is old but a subagent file is recent', () => {
    expect(mayHaveDailyUsage(sessionAt(cutoff - 1, [cutoff - 5, NOW]), window)).toBe(true)
  })

  it('judges by the lead file alone when the subagents could not be listed', () => {
    const entry = {
      transcript: ok({ path: '/x.jsonl', mtimeMs: cutoff - 1, size: 1, ino: 1, dev: 1 }),
      subagents: err({ reason: 'unreadable' as const, code: 'EACCES' })
    }

    expect(mayHaveDailyUsage(entry, window)).toBe(false)
  })

  it('keeps a session whose transcript could not be stat’d, to count it as unreadable', () => {
    const entry = {
      transcript: err({ reason: 'unreadable' as const, code: 'EACCES' }),
      subagents: ok([])
    }

    expect(mayHaveDailyUsage(entry, window)).toBe(true)
  })
})

describe('mayArchivedHaveDailyUsage', () => {
  const cutoff = NOW - 7 * DAY - DAY - SKIP_UNREAD_SLACK_MS

  it('keeps a session whose last message is at the cutoff, and drops one a millisecond before', () => {
    expect(mayArchivedHaveDailyUsage({ latestMs: cutoff, modifiedMs: null }, window)).toBe(true)
    expect(mayArchivedHaveDailyUsage({ latestMs: cutoff - 1, modifiedMs: null }, window)).toBe(
      false
    )
  })

  it('judges by the file time when there is no message time', () => {
    expect(mayArchivedHaveDailyUsage({ latestMs: null, modifiedMs: cutoff }, window)).toBe(true)
    expect(mayArchivedHaveDailyUsage({ latestMs: null, modifiedMs: cutoff - 1 }, window)).toBe(
      false
    )
  })

  it('keeps a session when either time is recent, since a restored transcript has a file time later than its messages', () => {
    expect(mayArchivedHaveDailyUsage({ latestMs: cutoff - 1, modifiedMs: cutoff }, window)).toBe(
      true
    )
    expect(mayArchivedHaveDailyUsage({ latestMs: cutoff, modifiedMs: cutoff - 1 }, window)).toBe(
      true
    )
  })

  it('keeps a session with neither time, to count it as unreadable', () => {
    expect(mayArchivedHaveDailyUsage({ latestMs: null, modifiedMs: null }, window)).toBe(true)
  })
})

describe('mayArchivedCountInWindow', () => {
  const cutoff = NOW - 7 * DAY

  it('keeps a session last active at the window start, and drops one a millisecond before', () => {
    expect(mayArchivedCountInWindow({ latestMs: cutoff, modifiedMs: NOW }, window)).toBe(true)
    expect(mayArchivedCountInWindow({ latestMs: cutoff - 1, modifiedMs: NOW }, window)).toBe(false)
  })

  it('judges by the file time when there is no message time', () => {
    expect(mayArchivedCountInWindow({ latestMs: null, modifiedMs: cutoff }, window)).toBe(true)
    expect(mayArchivedCountInWindow({ latestMs: null, modifiedMs: cutoff - 1 }, window)).toBe(false)
  })

  it('keeps a session with no file time, since the totals count it as unreadable', () => {
    expect(mayArchivedCountInWindow({ latestMs: cutoff - 1, modifiedMs: null }, window)).toBe(true)
  })
})

describe('isBeforeTotalsWindow', () => {
  const cutoff = NOW - 7 * DAY

  it('is false at the cutoff and true a millisecond before, by the last message', () => {
    expect(isBeforeTotalsWindow({ latestMs: cutoff, mtimeMs: 0 }, cutoff)).toBe(false)
    expect(isBeforeTotalsWindow({ latestMs: cutoff - 1, mtimeMs: NOW }, cutoff)).toBe(true)
  })

  it('goes by the file time when there is no last message', () => {
    expect(isBeforeTotalsWindow({ latestMs: null, mtimeMs: cutoff }, cutoff)).toBe(false)
    expect(isBeforeTotalsWindow({ latestMs: null, mtimeMs: cutoff - 1 }, cutoff)).toBe(true)
  })
})
