import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the series fills’ stylesheet', () => {
  const css = readFileSync(new URL('../SeriesFill.module.css', import.meta.url), 'utf8')
  const rule = (name: string): string => {
    const body = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
    if (body === undefined) throw new Error(`No .${name} rule in the stylesheet`)
    return body
  }

  it('fails to find a rule that is not there, so a missing rule cannot pass a check', () => {
    expect(() => rule('series9')).toThrow('No .series9 rule')
  })

  it('hatches the other series, so it is told apart without color', () => {
    expect(rule('other')).toContain('repeating-linear-gradient')
    expect(rule('other')).toContain('var(--color-model-other)')
  })

  it('dots the haiku series over its color, so it is told apart without color', () => {
    expect(rule('haiku')).toContain('radial-gradient')
    expect(rule('haiku')).toContain('var(--color-model-haiku)')
  })

  it.each(['fable', 'opus', 'sonnet'])('fills %s with its flat model color', (name) => {
    expect(rule(name)).not.toContain('gradient')
    expect(rule(name)).toMatch(new RegExp(`background:\\s*var\\(--color-model-${name}\\)`))
  })

  it('keeps every series’ own colors in forced-colors mode, which would otherwise drop them', () => {
    const selectors = ['fable', 'opus', 'sonnet', 'haiku', 'other']
      .map((name) => `\\.${name}`)
      .join(',\\s*')
    const group = new RegExp(
      `${selectors}\\s*\\{\\s*@media\\s*\\(forced-colors:\\s*active\\)\\s*\\{[^}]*forced-color-adjust:\\s*none`
    )

    expect(css).toMatch(group)
  })

  it('edges every series in the system text color in forced-colors mode, so a fill shows on any ground', () => {
    const forced = /@media\s*\(forced-colors:\s*active\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''

    expect(forced).toMatch(/outline:\s*var\(--size-hairline\)\s+solid\s+CanvasText/)
  })
})
