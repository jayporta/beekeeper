import { describe, expect, it } from 'vitest'
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

    expect(createDayKeyOf()(instant)).toBe(createDayKeyOf(hostTimeZone())(instant))
  })
})

describe('hostTimeZone', () => {
  it('names an IANA time zone the formatter accepts', () => {
    expect(() => createDayKeyOf(hostTimeZone())).not.toThrow()
    expect(hostTimeZone()).not.toBe('')
  })
})
