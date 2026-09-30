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
  status = 'success',
  dataUpdatedAt = NOW
): {
  queryKey: readonly unknown[]
  state: { status: string; dataUpdatedAt: number }
} => ({ queryKey, state: { status, dataUpdatedAt } })

describe('shouldPersistQuery', () => {
  it('persists the two list roots', () => {
    expect(PERSISTED_QUERY_ROOTS).toEqual(['projects', 'sessions'])
  })

  it.each([['projects'], ['sessions']])('persists a successful %s query', (root) => {
    expect(shouldPersistQuery(query([root, 'some-project']))).toBe(true)
  })

  it('persists a successful query whose whole key is the root', () => {
    expect(shouldPersistQuery(query(['projects']))).toBe(true)
  })

  it.each([['pending'], ['error']])('does not persist a query in the %s state', (status) => {
    expect(shouldPersistQuery(query(['projects'], status))).toBe(false)
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
    expect(shouldPersistQuery(query(['projects'], 'success', NOW))).toBe(true)
  })

  it('persists data exactly at the maximum age', () => {
    expect(shouldPersistQuery(query(['projects'], 'success', NOW - PERSIST_MAX_AGE_MS))).toBe(true)
  })

  it('does not persist data one millisecond past the maximum age', () => {
    expect(shouldPersistQuery(query(['projects'], 'success', NOW - PERSIST_MAX_AGE_MS - 1))).toBe(
      false
    )
  })

  it('does not persist data that was never fetched', () => {
    expect(shouldPersistQuery(query(['projects'], 'success', 0))).toBe(false)
  })
})
