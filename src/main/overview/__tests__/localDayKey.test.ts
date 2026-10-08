import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDayKeyOf, hostTimeZone } from '../localDayKey'

describe('createDayKeyOf', () => {
  it('puts 23:59 and 00:01 local time on different days', () => {
    const dayKeyOf = createDayKeyOf('America/Los_Angeles')

    expect(dayKeyOf(Date.parse('2026-03-01T07:59:00Z'))).toBe('2026-02-28')
    expect(dayKeyOf(Date.parse('2026-03-01T08:01:00Z'))).toBe('2026-03-01')
  })

  it('follows a zone with a half-hour offset', () => {
    const dayKeyOf = createDayKeyOf('Asia/Kolkata')

    expect(dayKeyOf(Date.parse('2026-03-01T18:29:00Z'))).toBe('2026-03-01')
    expect(dayKeyOf(Date.parse('2026-03-01T18:31:00Z'))).toBe('2026-03-02')
  })

  it('gives the same instant a different day in different zones', () => {
    const instant = Date.parse('2026-03-01T02:00:00Z')

    expect(createDayKeyOf('UTC')(instant)).toBe('2026-03-01')
    expect(createDayKeyOf('America/Los_Angeles')(instant)).toBe('2026-02-28')
  })

  it('pads a single-digit month and day', () => {
    expect(createDayKeyOf('UTC')(Date.parse('2026-01-05T12:00:00Z'))).toBe('2026-01-05')
  })

  it("uses the host's time zone when none is given", () => {
    const instant = Date.parse('2026-06-15T12:34:00Z')
    const original = process.env.TZ
    try {
      // 12:34 UTC is already the next day in Kiritimati (UTC+14), so a formatter that ignored the host would say 06-15.
      process.env.TZ = 'Pacific/Kiritimati'

      expect(hostTimeZone()).toBe('Pacific/Kiritimati')
      expect(createDayKeyOf()(instant)).toBe('2026-06-16')
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })

  it('puts the instants either side of a 45 minute offset’s midnight on different days', () => {
    // Asia/Kathmandu is UTC+5:45, so its midnight is 18:15 UTC, a quarter hour into the UTC hour.
    const dayKeyOf = createDayKeyOf('Asia/Kathmandu')

    expect(dayKeyOf(Date.parse('2026-03-01T18:14:59Z'))).toBe('2026-03-01')
    expect(dayKeyOf(Date.parse('2026-03-01T18:15:00Z'))).toBe('2026-03-02')
    expect(dayKeyOf(Date.parse('2026-03-01T18:29:59Z'))).toBe('2026-03-02')
    expect(dayKeyOf(Date.parse('2026-03-01T18:14:00Z'))).toBe('2026-03-01')
  })

  describe('with the formatter counted', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('formats once for instants in the same quarter hour', () => {
      const dayKeyOf = createDayKeyOf('UTC')
      const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
      const start = Date.parse('2026-03-01T10:00:00Z')

      for (let ms = 0; ms < 900_000; ms += 60_000) dayKeyOf(start + ms)

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('formats again when the quarter hour changes', () => {
      const dayKeyOf = createDayKeyOf('UTC')
      const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')

      dayKeyOf(Date.parse('2026-03-01T10:00:00Z'))
      dayKeyOf(Date.parse('2026-03-01T10:15:00Z'))
      dayKeyOf(Date.parse('2026-03-01T10:00:00Z'))

      expect(spy).toHaveBeenCalledTimes(3)
    })
  })
})

describe('hostTimeZone', () => {
  it('names an IANA time zone the formatter accepts', () => {
    expect(() => createDayKeyOf(hostTimeZone())).not.toThrow()
    expect(hostTimeZone()).not.toBe('')
  })
})
