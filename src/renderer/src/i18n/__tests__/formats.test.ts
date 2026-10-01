import { afterEach, describe, expect, it, vi } from 'vitest'
import { FORMAT_NAMES } from '../formats'
import { i18n } from '../i18n'
import { resources } from '../resources'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Every string leaf of a resource tree. */
function stringLeaves(node: unknown): string[] {
  if (typeof node === 'string') return [node]
  if (typeof node !== 'object' || node === null) return []
  return Object.values(node).flatMap(stringLeaves)
}

/** The format names used by `{{name, format}}` placeholders in a resource string. */
function formatNamesIn(text: string): string[] {
  return [...text.matchAll(/\{\{[^,}]+,\s*([^\s,(}]+)/g)].map((match) => match[1] ?? '')
}

describe('registered formats', () => {
  it('are the only formats the resources name', () => {
    const registered = FORMAT_NAMES.map((name) => name.toLowerCase())
    const used = stringLeaves(resources.en).flatMap(formatNamesIn)

    expect(used.length).toBeGreaterThan(0)
    for (const name of used) expect(registered).toContain(name.toLowerCase())
  })

  it('format a count with grouping for the active language', () => {
    const t = i18n.getFixedT('en-US', 'sessions')

    expect(t('search.matches', { count: 1234 })).toBe('1,234 sessions match')
  })
})

describe('format caching', () => {
  const distinct = Array.from({ length: 50 }, (_, i) => i + 1)

  it('builds one currency formatter per language, however many amounts it formats', () => {
    const t = i18n.getFixedT('en-NZ', 'sessions')
    const spy = vi.spyOn(Intl, 'NumberFormat')

    for (const n of distinct) t('usd', { value: n * 1.01 })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('builds one date formatter per language, however many times it formats', () => {
    const t = i18n.getFixedT('en-AU', 'sessions')
    const spy = vi.spyOn(Intl, 'DateTimeFormat')

    for (const n of distinct) t('lastActive', { value: n * 86_400_000 })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('builds one count formatter per language, however many counts it formats', () => {
    const t = i18n.getFixedT('en-CA', 'sessions')
    const spy = vi.spyOn(Intl, 'NumberFormat')

    for (const n of distinct) t('duration.minutes', { minutes: n })

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
