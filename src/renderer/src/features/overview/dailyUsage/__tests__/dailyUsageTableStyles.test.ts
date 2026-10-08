import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the table’s stylesheet', () => {
  const css = readFileSync(new URL('../DailyUsageTable.module.css', import.meta.url), 'utf8')
  const rule = (selector: string): string =>
    new RegExp(`${selector.replace(/[[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''

  it('scrolls sideways in its region instead of clipping', () => {
    expect(rule('.scroll')).toContain('overflow-x: auto')
  })

  it('draws the focus ring from the tokens on the region', () => {
    expect(css).toMatch(/&:focus-visible\s*\{[^}]*var\(--focus-ring\)/)
  })

  it('lets a row header wrap, so a long date does not force the table wider', () => {
    expect(rule("th[scope='row']")).not.toContain('nowrap')
  })
})
