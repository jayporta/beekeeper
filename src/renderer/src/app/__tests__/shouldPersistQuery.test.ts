import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSIST_MAX_AGE_MS } from '../persistMaxAge'
import { PERSISTED_QUERY_ROOTS, shouldPersistQuery } from '../shouldPersistQuery'

const NOW = Date.parse('2026-03-01T00:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

const query = (
  queryKey: readonly unknown[],
  state: { data?: unknown; dataUpdatedAt?: number } = {}
): {
  queryKey: readonly unknown[]
  state: { data: unknown; dataUpdatedAt: number }
} => ({ queryKey, state: { data: ['some', 'list'], dataUpdatedAt: NOW, ...state } })

describe('shouldPersistQuery', () => {
  it('persists the two lists and each folder’s totals and daily usage', () => {
    expect(PERSISTED_QUERY_ROOTS).toEqual([
      'projects',
      'sessions',
      'projectTotals',
      'projectDailyUsage'
    ])
  })

  it.each([['otelReceiver'], ['reportedCost']])(
    'never persists the telemetry query %s, since its data holds the receiver’s token or live figures',
    (root) => {
      expect(shouldPersistQuery(query([root, 'some-session']))).toBe(false)
    }
  )

  it.each([['projects'], ['sessions'], ['projectTotals'], ['projectDailyUsage']])(
    'persists a successful %s query',
    (root) => {
      expect(shouldPersistQuery(query([root, 'some-project']))).toBe(true)
    }
  )

  it('persists a successful query whose whole key is the root', () => {
    expect(shouldPersistQuery(query(['projects']))).toBe(true)
  })

  it('persists a query that holds data whatever its status, such as a failed background refetch', () => {
    // A refetch that fails sets the status to error but keeps the last good data.
    expect(shouldPersistQuery(query(['projects'], { data: [{ dirName: '-p' }] }))).toBe(true)
  })

  it('does not persist a query that holds no data, such as one still loading or failed at first', () => {
    expect(shouldPersistQuery(query(['projects'], { data: undefined }))).toBe(false)
  })

  it('persists data that is an empty list, which is still a result', () => {
    expect(shouldPersistQuery(query(['projects'], { data: [] }))).toBe(true)
  })

  it('does not persist a query under any other root', () => {
    expect(shouldPersistQuery(query(['session-detail', 'abc']))).toBe(false)
  })

  it('does not match a root by prefix of its first element', () => {
    expect(shouldPersistQuery(query(['projectsExtra']))).toBe(false)
  })

  it('does not persist a query whose key has a non-string root or is empty', () => {
    expect(shouldPersistQuery(query([{ root: 'projects' }]))).toBe(false)
    expect(shouldPersistQuery(query([]))).toBe(false)
  })
})

describe('shouldPersistQuery freshness', () => {
  it('persists data fetched just now', () => {
    expect(shouldPersistQuery(query(['projects'], { dataUpdatedAt: NOW }))).toBe(true)
  })

  it('persists data exactly at the maximum age', () => {
    expect(
      shouldPersistQuery(query(['projects'], { dataUpdatedAt: NOW - PERSIST_MAX_AGE_MS }))
    ).toBe(true)
  })

  it('does not persist data one millisecond past the maximum age', () => {
    expect(
      shouldPersistQuery(query(['projects'], { dataUpdatedAt: NOW - PERSIST_MAX_AGE_MS - 1 }))
    ).toBe(false)
  })

  it('does not persist data stamped in the future, as when the clock moved backward', () => {
    expect(shouldPersistQuery(query(['projects'], { dataUpdatedAt: NOW + 1 }))).toBe(false)
    expect(
      shouldPersistQuery(query(['projects'], { dataUpdatedAt: NOW + PERSIST_MAX_AGE_MS }))
    ).toBe(false)
  })

  it('does not persist data that was never fetched', () => {
    expect(shouldPersistQuery(query(['projects'], { dataUpdatedAt: 0 }))).toBe(false)
  })
})
