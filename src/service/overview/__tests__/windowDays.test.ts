import { describe, expect, it } from 'vitest'
import { windowDays } from '../windowDays'

describe('windowDays', () => {
  it('gives seven day keys for the 7 day window, oldest first, ending today', () => {
    expect(windowDays({ todayKey: '2026-03-10', window: '7d' })).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10'
    ])
  })

  it('gives thirty day keys for the 30 day window', () => {
    const days = windowDays({ todayKey: '2026-03-10', window: '30d' })

    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-02-09')
    expect(days.at(-1)).toBe('2026-03-10')
  })

  it('crosses a month boundary', () => {
    expect(windowDays({ todayKey: '2026-03-02', window: '7d' })[0]).toBe('2026-02-24')
  })

  it('includes February 29 in a leap year', () => {
    expect(windowDays({ todayKey: '2028-03-02', window: '7d' })).toContain('2028-02-29')
  })

  it('crosses a year boundary', () => {
    expect(windowDays({ todayKey: '2026-01-02', window: '7d' })[0]).toBe('2025-12-27')
  })

  it.each(['7d', '30d'] as const)(
    'has unique consecutive keys across a daylight saving change in the %s window',
    (window) => {
      // The United States changed clocks on 2026-11-01 and 2026-03-08, Europe on 2026-10-25.
      for (const todayKey of ['2026-11-03', '2026-03-10', '2026-10-27']) {
        const days = windowDays({ todayKey, window })

        expect(new Set(days).size).toBe(days.length)
        for (let i = 1; i < days.length; i += 1) {
          const gap = Date.parse(`${days[i]}T00:00:00Z`) - Date.parse(`${days[i - 1]}T00:00:00Z`)
          expect(gap).toBe(24 * 60 * 60 * 1000)
        }
      }
    }
  )
})
