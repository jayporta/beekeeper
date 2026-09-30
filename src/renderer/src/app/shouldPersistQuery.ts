import type { QueryKey } from '@tanstack/react-query'

/** The first query-key element of every query whose result is persisted to IndexedDB. */
const PERSISTED_QUERY_ROOTS: readonly unknown[] = ['projects', 'sessions']

/**
 * Decides whether a query's result is saved to the persisted cache: only a
 * successful query whose key starts with `projects` or `sessions`, the two
 * lists that let the app open with its last results.
 *
 * @param query - The query being dehydrated.
 * @returns `true` to persist it.
 */
export function shouldPersistQuery(query: {
  readonly queryKey: QueryKey
  readonly state: { readonly status: string }
}): boolean {
  return query.state.status === 'success' && PERSISTED_QUERY_ROOTS.includes(query.queryKey[0])
}
