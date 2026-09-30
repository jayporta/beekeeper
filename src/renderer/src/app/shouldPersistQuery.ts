import type { QueryKey } from '@tanstack/react-query'
import { PERSIST_MAX_AGE_MS } from './persistMaxAge'

/**
 * The first query-key element of every query whose result is persisted to
 * IndexedDB: the two lists that let the app open with its last results.
 */
export const PERSISTED_QUERY_ROOTS: readonly unknown[] = ['projects', 'sessions']

/**
 * Decides whether a query's result is saved to the persisted cache: a query
 * whose key starts with `projects` or `sessions`, that holds data, and whose
 * data was fetched within {@link PERSIST_MAX_AGE_MS}. Its status doesn't
 * matter: a failed background refetch sets the status to error but keeps the
 * last good data, which should stay cached. The persister's own
 * `maxAge` checks the whole saved blob's timestamp, which every save
 * refreshes, so without this a list that is never refetched would be kept
 * indefinitely.
 *
 * @param query - The query being dehydrated.
 * @returns `true` to persist it.
 */
export function shouldPersistQuery(query: {
  readonly queryKey: QueryKey
  readonly state: { readonly data: unknown; readonly dataUpdatedAt: number }
}): boolean {
  return (
    query.state.data !== undefined &&
    PERSISTED_QUERY_ROOTS.includes(query.queryKey[0]) &&
    Date.now() - query.state.dataUpdatedAt <= PERSIST_MAX_AGE_MS
  )
}
