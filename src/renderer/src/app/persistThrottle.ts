/**
 * The least time between two saves of the query cache to IndexedDB: 5 seconds.
 * Live updates refetch the visible lists every few seconds, and each result
 * would otherwise rewrite the whole saved cache every second.
 */
export const PERSIST_THROTTLE_MS = 5000
