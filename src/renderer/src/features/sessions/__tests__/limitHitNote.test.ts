import { describe, expect, it } from 'vitest'
import { limitHitNote } from '../limitHitNote'
import { testSessionsT } from '../testSessionsT'

const RESETS = Date.parse('2026-01-08T10:00:00Z')
const BEFORE = { nowMs: RESETS - 1, t: testSessionsT }
const AT = { nowMs: RESETS, t: testSessionsT }

describe('limitHitNote', () => {
  it('reports no note for a session that hit no limit', () => {
    expect(limitHitNote(null, BEFORE)).toBeNull()
  })

  it('names the 7-day limit and when it resets while the reset is ahead', () => {
    expect(limitHitNote({ window: 'sevenDay', resetsAtMs: RESETS }, BEFORE)).toMatch(
      /^hit 7-day limit, resets [A-Z][a-z]{2} \d{1,2}, 2026, \d{1,2}:\d{2}\s[AP]M$/
    )
  })

  it('names the 5-hour limit', () => {
    expect(limitHitNote({ window: 'fiveHour', resetsAtMs: RESETS }, BEFORE)).toMatch(
      /^hit 5-hour limit, resets /
    )
  })

  it('drops the reset time once the window has reset', () => {
    expect(limitHitNote({ window: 'sevenDay', resetsAtMs: RESETS }, AT)).toBe('hit 7-day limit')
    expect(limitHitNote({ window: 'fiveHour', resetsAtMs: RESETS }, AT)).toBe('hit 5-hour limit')
  })
})
