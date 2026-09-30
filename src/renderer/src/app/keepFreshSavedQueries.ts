import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { shouldPersistQuery } from './shouldPersistQuery'

/** What {@link shouldPersistQuery} reads of a saved query, once checked. */
interface SavedQuery {
  readonly queryKey: readonly unknown[]
  readonly state: { readonly data: unknown; readonly dataUpdatedAt: number }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSavedQuery(value: unknown): value is SavedQuery {
  return (
    isRecord(value) &&
    Array.isArray(value.queryKey) &&
    isRecord(value.state) &&
    typeof value.state.dataUpdatedAt === 'number'
  )
}

/**
 * Drops the saved queries that have passed the maximum age since they were
 * saved. The age filter at save time can't cover that, and the persister's own
 * `maxAge` checks the whole blob's timestamp, which every save refreshes, so a
 * list saved at 6 days old would otherwise be restored at 9. Every other field
 * of the client and its state is kept.
 *
 * @param saved - The parsed saved cache, which is untrusted.
 * @returns The client with only the queries {@link shouldPersistQuery} still
 * accepts, or `undefined` when it lacks the expected shape.
 */
export function keepFreshSavedQueries(saved: unknown): PersistedClient | undefined {
  if (!isRecord(saved) || !isRecord(saved.clientState)) return undefined

  const { queries } = saved.clientState
  if (!Array.isArray(queries) || !queries.every(isSavedQuery)) return undefined

  // The queries were checked above, and the rest of the client is kept as saved.
  return {
    ...saved,
    clientState: { ...saved.clientState, queries: queries.filter(shouldPersistQuery) }
  } as unknown as PersistedClient
}
