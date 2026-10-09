import { describe, expect, it } from 'vitest'
import { ARCHIVE_DETAIL_AFTER_DAYS } from '../archiveConstants'
import { isDetailDue } from '../isDetailDue'

const DAY_MS = 86_400_000
const NOW = 100 * DAY_MS

describe('isDetailDue', () => {
  it('is false for a session active within the waiting period', () => {
    const last = NOW - (ARCHIVE_DETAIL_AFTER_DAYS * DAY_MS - 1)

    expect(isDetailDue(last, NOW)).toBe(false)
  })

  it('is true once the session has been quiet for the whole waiting period', () => {
    const last = NOW - ARCHIVE_DETAIL_AFTER_DAYS * DAY_MS

    expect(isDetailDue(last, NOW)).toBe(true)
  })

  it('is false when the last activity is unknown', () => {
    expect(isDetailDue(null, NOW)).toBe(false)
  })

  it('is false for activity in the future', () => {
    expect(isDetailDue(NOW + DAY_MS, NOW)).toBe(false)
  })
})
