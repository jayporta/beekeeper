import { describe, expect, it } from 'vitest'
import { dayKeyDate } from '../dayKeyDate'
import { localDayKey } from '../localDayKey'

describe('localDayKey', () => {
  it('puts 23:59 and 00:01 local time on different days', () => {
    expect(localDayKey(new Date(2026, 2, 10, 23, 59).getTime())).toBe('2026-03-10')
    expect(localDayKey(new Date(2026, 2, 11, 0, 1).getTime())).toBe('2026-03-11')
  })

  it('pads a single-digit month and day', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05')
  })
})

describe('dayKeyDate', () => {
  it('is local noon of the day', () => {
    const date = new Date(dayKeyDate('2026-03-10'))

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 2, 10, 12
    ])
  })

  it.each(['2026-01-05', '2026-03-08', '2026-10-25', '2026-11-01', '2028-02-29'])(
    'round-trips %s through localDayKey, whatever the zone does that day',
    (day) => {
      expect(localDayKey(dayKeyDate(day))).toBe(day)
    }
  )
})
