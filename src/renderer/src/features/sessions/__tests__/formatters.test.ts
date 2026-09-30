import { describe, expect, it } from 'vitest'
import { formatDuration } from '../formatDuration'
import { formatLastActive } from '../formatLastActive'
import { formatUsd } from '../formatUsd'

const MIN = 60_000
const span = (minutes: number): { earliestMs: number; latestMs: number } => ({
  earliestMs: 1000,
  latestMs: 1000 + minutes * MIN
})

describe('formatDuration', () => {
  it('reports null without activity', () => {
    expect(formatDuration(null)).toBeNull()
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
    expect(formatDuration(span(minutes))).toBe(expected)
  })

  it('treats a span that runs backwards as under a minute', () => {
    expect(formatDuration({ earliestMs: 5000, latestMs: 1000 })).toBe('<1m')
  })
})

describe('formatUsd', () => {
  it('reports null for an unknown amount', () => {
    expect(formatUsd(null)).toBeNull()
  })

  it.each([
    [0, '$0.00'],
    [0.004, '<$0.01'],
    [0.01, '$0.01'],
    [12.345, '$12.35'],
    [1234.5, '$1,234.50']
  ])('formats %s as %s', (usd, expected) => {
    expect(formatUsd(usd)).toBe(expected)
  })
})

describe('formatLastActive', () => {
  it('reports null for an unknown time', () => {
    expect(formatLastActive(null)).toBeNull()
  })

  it('formats a medium date and a short time', () => {
    expect(formatLastActive(Date.parse('2026-01-15T12:00:00.000Z'))).toMatch(
      /^[A-Z][a-z]{2} \d{1,2}, 2026, \d{1,2}:\d{2}\s[AP]M$/
    )
  })
})
