import type { QueryState } from '@tanstack/react-query'

/**
 * Rewrites a query's state for the persisted cache so a list that holds data
 * is restored as a success. A failed background refetch leaves a query in the
 * error state with its last good data, and saving that as is would restore it
 * with `isError` set over a cached list, and with an `error` that JSON turned
 * into an empty object, until the next refetch succeeds. The data and its
 * timestamp are kept; the failure is dropped.
 *
 * @param state - A query's state as dehydrated.
 * @returns The same state when it is not an error that still holds data,
 * otherwise a copy marked as a success with the failure cleared.
 */
export function toCachedQueryState<T extends QueryState>(state: T): T {
  if (state.status !== 'error' || state.data === undefined) return state
  return {
    ...state,
    status: 'success',
    error: null,
    fetchFailureCount: 0,
    fetchFailureReason: null
  }
}
