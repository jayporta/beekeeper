import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the table’s stylesheet', () => {
  const css = readFileSync(new URL('../DailyUsageTable.module.css', import.meta.url), 'utf8')
  const rule = (selector: string): string => {
    const pattern = new RegExp(`${selector.replace(/[[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
    const body = pattern.exec(css)?.[1]
    if (body === undefined) throw new Error(`No ${selector} rule in the stylesheet`)
    return body
  }

  it('fails to find a rule that is not there, so a missing rule cannot pass a check', () => {
    expect(() => rule('.missing')).toThrow('No .missing rule')
  })

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
