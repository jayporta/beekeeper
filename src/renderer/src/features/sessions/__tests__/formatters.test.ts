import { describe, expect, it } from 'vitest'
import { i18n } from '@renderer/i18n/i18n'
import { formatDuration } from '../formatDuration'
import { formatLastActive } from '../formatLastActive'
import { testSessionsT } from '../testSessionsT'

const MIN = 60_000
const span = (minutes: number): { earliestMs: number; latestMs: number } => ({
  earliestMs: 1000,
  latestMs: 1000 + minutes * MIN
})

describe('formatDuration', () => {
  it('reports null without activity', () => {
    expect(formatDuration(null, testSessionsT)).toBeNull()
  })

  it.each([
    [0, '<1m'],
    [0.9, '<1m'],
    [1, '1m'],
    [42, '42m'],
    [59, '59m'],
    [60, '1h'],
    [185, '3h 5m'],
    [1500, '25h']
  ])('formats %s minutes as %s', (minutes, expected) => {
    expect(formatDuration(span(minutes), testSessionsT)).toBe(expected)
  })

  it('treats a span that runs backwards as under a minute', () => {
    expect(formatDuration({ earliestMs: 5000, latestMs: 1000 }, testSessionsT)).toBe('<1m')
  })
})

describe('formatLastActive', () => {
  const MS = Date.parse('2026-01-15T12:00:00.000Z')

  it('reports null for an unknown time', () => {
    expect(formatLastActive(null, testSessionsT)).toBeNull()
  })

  it('formats a medium date and a short time', () => {
    expect(formatLastActive(MS, testSessionsT)).toMatch(
      /^[A-Z][a-z]{2} \d{1,2}, 2026, \d{1,2}:\d{2}\s[AP]M$/
    )
  })

  it('formats the time the way the active language does', () => {
    const british = i18n.getFixedT('en-GB', 'sessions')
    const expected = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

    expect(formatLastActive(MS, british)).toBe(expected.format(MS))
  })
})
