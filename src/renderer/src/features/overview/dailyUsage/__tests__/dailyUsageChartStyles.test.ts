import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the chart’s stylesheet', () => {
  const css = readFileSync(new URL('../DailyUsageChart.module.css', import.meta.url), 'utf8')
  const tokens = readFileSync(new URL('../../../../assets/tokens.css', import.meta.url), 'utf8')

  /** The declarations of the rule with `selector`, nested rules included, at any depth. */
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`)
    if (start === -1) throw new Error(`No ${selector} rule in the stylesheet`)
    const open = css.indexOf('{', start)
    let depth = 0
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      if (css[i] === '}') depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
    throw new Error(`The ${selector} rule is never closed`)
  }

  it('fails to find a rule that is not there, so a missing rule cannot pass a check', () => {
    expect(() => rule('.missing')).toThrow('No .missing rule')
  })

  it('leaves no gap between a bar’s segments, which would eat a short bar’s height', () => {
    expect(rule('.stack')).not.toMatch(/\bgap\b/)
  })

  it('separates each segment from the one below it with a hairline of ground at its own bottom edge', () => {
    expect(rule('& > * + *')).toMatch(
      /box-shadow:\s*inset\s+0\s+calc\(-1\s*\*\s*var\(--size-hairline\)\)\s+0\s+var\(--color-bg\)/
    )
  })

  it('gives a bar a minimum height, so a day with tokens is never invisible', () => {
    expect(rule('.stack')).toMatch(/min-block-size:\s*var\(--size-chart-bar-min\)/)
    expect(tokens).toMatch(/--size-chart-bar-min:\s*\S+;/)
  })

  it('keeps a segment above another at least two hairlines tall, so a hairline of color shows beside its separator', () => {
    expect(rule('& > * + *')).toMatch(/min-block-size:\s*calc\(2\s*\*\s*var\(--size-hairline\)\)/)
  })

  it('keeps the bottom segment at least a hairline tall, so other segments cannot squeeze it out', () => {
    expect(rule('& > *')).toMatch(/min-block-size:\s*var\(--size-hairline\)/)
  })

  it('keeps every segment three hairlines tall in forced colors, so its color shows inside its outline', () => {
    expect(rule('@media (forced-colors: active)')).toMatch(
      /&\s*>\s*\*\s*\{[^}]*min-block-size:\s*calc\(3\s*\*\s*var\(--size-hairline\)\)/
    )
  })

  it('puts the forced-colors minimum after the segment minimums it must override at equal specificity', () => {
    const forced = css.indexOf('@media (forced-colors: active)')

    expect(forced).toBeGreaterThan(css.indexOf('& > * {'))
    expect(forced).toBeGreaterThan(css.indexOf('& > * + * {'))
  })

  it.each(['.tick', '.gridline'])('pins a lone %s to the bottom, where zero sits', (name) => {
    expect(rule(name)).toMatch(/&:only-child\s*\{[^}]*margin-block-start:\s*auto/)
  })
})
