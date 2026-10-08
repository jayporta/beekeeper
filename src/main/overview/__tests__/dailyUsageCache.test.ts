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

describe('createDailyUsageCache', () => {
  it('returns a stored complete result', () => {
    const cache = createDailyUsageCache()
    const stored = usage(2)

    cache.set({ key: 'a', usage: stored, subagentsListed: true })

    expect(cache.get('a')).toBe(stored)
  })

  it('does not store a result with an unreadable subagent', () => {
    const cache = createDailyUsageCache()

    cache.set({ key: 'a', usage: usage(1, { unreadableSubagents: 1 }), subagentsListed: true })

    expect(cache.get('a')).toBeUndefined()
  })

  it('does not store a result whose subagents folder could not be listed', () => {
    const cache = createDailyUsageCache()

    cache.set({ key: 'a', usage: usage(1), subagentsListed: false })

    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts the least recently used result once the weight passes the bound', () => {
    // Each result weighs one plus its bucket count: 3 here, so two fit in 6 and a third does not.
    const cache = createDailyUsageCache({ maxWeight: 6 })
    cache.set({ key: 'a', usage: usage(2), subagentsListed: true })
    cache.set({ key: 'b', usage: usage(2), subagentsListed: true })
    cache.get('a')

    cache.set({ key: 'c', usage: usage(2), subagentsListed: true })

    expect(cache.get('a')).toBeDefined()
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBeDefined()
  })

  it('weighs a result with more buckets as heavier', () => {
    const cache = createDailyUsageCache({ maxWeight: 4 })
    cache.set({ key: 'small', usage: usage(1), subagentsListed: true })

    cache.set({ key: 'large', usage: usage(10), subagentsListed: true })

    expect(cache.get('large')).toBeUndefined()
    expect(cache.get('small')).toBeDefined()
  })
})
