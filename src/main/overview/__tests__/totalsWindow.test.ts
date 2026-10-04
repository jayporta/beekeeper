import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import { SKIP_UNREAD_SLACK_MS, TOTALS_WINDOW_MS, mayCountInWindow } from '../totalsWindow'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1000 * DAY
const window = { nowMs: NOW, windowMs: 7 * DAY }

const entryAt = (mtimeMs: number): Pick<SessionEntry, 'transcript'> => ({
  transcript: ok({ path: '/x.jsonl', mtimeMs, size: 1 })
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
