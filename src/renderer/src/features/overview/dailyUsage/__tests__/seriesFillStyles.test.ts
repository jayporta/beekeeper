import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the series fills’ stylesheet', () => {
  const css = readFileSync(new URL('../SeriesFill.module.css', import.meta.url), 'utf8')
  const rule = (name: string): string =>
    new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''

  it('hatches the other series, so it is told apart without color', () => {
    expect(rule('series4')).toContain('repeating-linear-gradient')
  })

  it.each(['series0', 'series1', 'series2', 'series3'])('fills %s with its flat color', (name) => {
    expect(rule(name)).not.toContain('gradient')
    expect(rule(name)).toMatch(/background:\s*var\(--color-series-\d\)/)
  })
})
