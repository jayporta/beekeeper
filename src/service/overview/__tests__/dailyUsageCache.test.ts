import { describe, expect, it } from 'vitest'
import type { DailyUsageBucket, SessionDailyUsage } from '../../../core/usage/dailyUsage'
import { createDailyUsageCache } from '../dailyUsageCache'

function usage(bucketCount: number, overrides: Partial<SessionDailyUsage> = {}): SessionDailyUsage {
  const buckets: DailyUsageBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    day: `2026-01-${String(i + 1).padStart(2, '0')}`,
    model: 'claude-opus-5',
    tokens: 1
  }))
  return { buckets, undatedMessages: 0, skippedLines: 0, unreadableSubagents: 0, ...overrides }
}

const entry = (
  key: string,
  stored: SessionDailyUsage,
  filesKey = 'f1'
): Parameters<ReturnType<typeof createDailyUsageCache>['set']>[0] => ({
  key,
  filesKey,
  usage: stored,
  subagentsListed: true
})

describe('createDailyUsageCache', () => {
  it('returns a stored complete result for the same session and files', () => {
    const cache = createDailyUsageCache()
    const stored = usage(2)

    cache.set(entry('a', stored))

    expect(cache.get({ key: 'a', filesKey: 'f1' })).toBe(stored)
  })

  it('misses when the session’s files have changed', () => {
    const cache = createDailyUsageCache()
    cache.set(entry('a', usage(2), 'f1'))

    expect(cache.get({ key: 'a', filesKey: 'f2' })).toBeUndefined()
  })

  it('replaces a session’s entry when it is stored again for changed files', () => {
    const cache = createDailyUsageCache()
    const changed = usage(3)
    cache.set(entry('a', usage(2), 'f1'))

    cache.set(entry('a', changed, 'f2'))

    expect(cache.size).toBe(1)
    expect(cache.get({ key: 'a', filesKey: 'f1' })).toBeUndefined()
    expect(cache.get({ key: 'a', filesKey: 'f2' })).toBe(changed)
  })

  it('keeps separate sessions, and the same session in another time zone, apart', () => {
    const cache = createDailyUsageCache()
    cache.set(entry('utc\0p\0one', usage(1)))
    cache.set(entry('utc\0p\0two', usage(1)))
    cache.set(entry('tokyo\0p\0one', usage(1)))

    expect(cache.size).toBe(3)
  })

  it('does not store a result with an unreadable subagent', () => {
    const cache = createDailyUsageCache()

    cache.set({ ...entry('a', usage(1, { unreadableSubagents: 1 })) })

    expect(cache.get({ key: 'a', filesKey: 'f1' })).toBeUndefined()
  })

  it('does not store a result whose subagents folder could not be listed', () => {
    const cache = createDailyUsageCache()

    cache.set({ ...entry('a', usage(1)), subagentsListed: false })

    expect(cache.get({ key: 'a', filesKey: 'f1' })).toBeUndefined()
  })

  it('evicts the least recently used result once the weight passes the bound', () => {
    // Each result weighs one plus its bucket count: 3 here, so two fit in 6 and a third does not.
    const cache = createDailyUsageCache({ maxWeight: 6 })
    cache.set(entry('a', usage(2)))
    cache.set(entry('b', usage(2)))
    cache.get({ key: 'a', filesKey: 'f1' })

    cache.set(entry('c', usage(2)))

    expect(cache.get({ key: 'a', filesKey: 'f1' })).toBeDefined()
    expect(cache.get({ key: 'b', filesKey: 'f1' })).toBeUndefined()
    expect(cache.get({ key: 'c', filesKey: 'f1' })).toBeDefined()
  })

  it('weighs a result with more buckets as heavier', () => {
    const cache = createDailyUsageCache({ maxWeight: 4 })
    cache.set(entry('small', usage(1)))

    cache.set(entry('large', usage(10)))

    expect(cache.get({ key: 'large', filesKey: 'f1' })).toBeUndefined()
    expect(cache.get({ key: 'small', filesKey: 'f1' })).toBeDefined()
  })
})
