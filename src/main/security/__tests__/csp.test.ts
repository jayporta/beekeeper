import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from '../csp'

describe('buildContentSecurityPolicy', () => {
  it('returns the strict production policy when there is no dev server', () => {
    const csp = buildContentSecurityPolicy(undefined)

    expect(csp).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
        "font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; " +
        "form-action 'none'; frame-ancestors 'none'"
    )
  })

  it('scopes script, style, and connect sources to the dev server origin', () => {
    const csp = buildContentSecurityPolicy('http://localhost:5173')

    expect(csp).toContain("script-src 'self' 'unsafe-inline' http://localhost:5173")
    expect(csp).toContain("style-src 'self' 'unsafe-inline' http://localhost:5173")
    expect(csp).toContain("connect-src 'self' http://localhost:5173 ws://localhost:5173")
  })

  it('keeps object-src, base-uri, and frame-ancestors locked down in development', () => {
    const csp = buildContentSecurityPolicy('http://localhost:5173')

    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })
})
