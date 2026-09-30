import type { QueryKey } from '@tanstack/react-query'
import { PERSIST_MAX_AGE_MS } from './persistMaxAge'

/**
 * The first query-key element of every query whose result is persisted to
 * IndexedDB: the two lists that let the app open with its last results.
 */
export const PERSISTED_QUERY_ROOTS: readonly unknown[] = ['projects', 'sessions']

/**
 * Decides whether a query's result is saved to the persisted cache: only a
 * successful query whose key starts with `projects` or `sessions` and whose
 * data was fetched within {@link PERSIST_MAX_AGE_MS}. The persister's own
 * `maxAge` checks the whole saved blob's timestamp, which every save
 * refreshes, so without this a list that is never refetched would be kept
 * indefinitely.
 *
 * @param query - The query being dehydrated.
 * @returns `true` to persist it.
 */
export function shouldPersistQuery(query: {
  readonly queryKey: QueryKey
  readonly state: { readonly status: string; readonly dataUpdatedAt: number }
}): boolean {
  return (
    query.state.status === 'success' &&
    PERSISTED_QUERY_ROOTS.includes(query.queryKey[0]) &&
    Date.now() - query.state.dataUpdatedAt <= PERSIST_MAX_AGE_MS
  )
}
