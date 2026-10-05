import { describe, expect, it } from 'vitest'
import { formatUsd } from '../formatUsd'
import { i18n } from '../i18n'

const t = i18n.getFixedT('en-US', 'common')

describe('formatUsd', () => {
  it('reports null for an unknown amount', () => {
    expect(formatUsd(null, t)).toBeNull()
  })

  it.each([
    [0, '$0.00'],
    [0.004, '<$0.01'],
    [0.01, '$0.01'],
    [12.345, '$12.35'],
    [1234.5, '$1,234.50']
  ])('formats %s as %s', (usd, expected) => {
    expect(formatUsd(usd, t)).toBe(expected)
  })

  it('formats an amount the way the active language does', () => {
    const british = i18n.getFixedT('en-GB', 'common')
    const expected = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' })

    expect(formatUsd(1234.5, british)).toBe(expected.format(1234.5))
    expect(formatUsd(0.004, british)).toBe(`<${expected.format(0.01)}`)
  })

  it('formats through a translate function bound to another namespace', () => {
    expect(formatUsd(12.5, i18n.getFixedT('en-US', 'sessions'))).toBe('$12.50')
    expect(formatUsd(12.5, i18n.getFixedT('en-US', 'overview'))).toBe('$12.50')
  })
})
