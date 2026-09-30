import type { QueryState } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { toCachedQueryState } from '../toCachedQueryState'

const state = (overrides: Partial<QueryState>): QueryState => ({
  data: undefined,
  dataUpdateCount: 1,
  dataUpdatedAt: 1000,
  error: null,
  errorUpdateCount: 0,
  errorUpdatedAt: 0,
  fetchFailureCount: 0,
  fetchFailureReason: null,
  fetchMeta: null,
  isInvalidated: false,
  status: 'success',
  fetchStatus: 'idle',
  ...overrides
})

describe('toCachedQueryState', () => {
  it('turns an errored query that still holds data back into a successful one', () => {
    const failed = state({
      status: 'error',
      data: ['old'],
      error: new Error('refetch failed'),
      errorUpdateCount: 1,
      errorUpdatedAt: 2000,
      fetchFailureCount: 1,
      fetchFailureReason: new Error('refetch failed')
    })

    const cached = toCachedQueryState(failed)

    expect(cached.status).toBe('success')
    expect(cached.error).toBeNull()
    expect(cached.fetchFailureCount).toBe(0)
    expect(cached.fetchFailureReason).toBeNull()
  })

  it('keeps the data and its timestamp', () => {
    const cached = toCachedQueryState(
      state({ status: 'error', data: ['old'], dataUpdatedAt: 1234 })
    )

    expect(cached.data).toEqual(['old'])
    expect(cached.dataUpdatedAt).toBe(1234)
  })

  it('does not change the state it was given', () => {
    const failed = state({ status: 'error', data: ['old'], error: new Error('x') })

    toCachedQueryState(failed)

    expect(failed.status).toBe('error')
    expect(failed.error).toBeInstanceOf(Error)
  })

  it('returns a successful state as it is', () => {
    const ok = state({ status: 'success', data: ['a'] })

    expect(toCachedQueryState(ok)).toBe(ok)
  })

  it('returns a pending state as it is', () => {
    const pending = state({ status: 'pending', data: undefined, fetchStatus: 'fetching' })

    expect(toCachedQueryState(pending)).toBe(pending)
  })

  it('returns an errored state with no data as it is, since there is nothing to show', () => {
    const failed = state({ status: 'error', data: undefined, error: new Error('x') })

    expect(toCachedQueryState(failed)).toBe(failed)
  })
})
