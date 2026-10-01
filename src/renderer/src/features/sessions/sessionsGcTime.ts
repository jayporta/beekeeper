/**
 * How long a session list stays cached after the last view of it closes: 5
 * minutes. `createQueryClient` sets it as the default for every `sessions`
 * query, including one restored from the persisted cache, so only lists in
 * use stay in the persisted cache, not every folder's from the last 7 days.
 */
export const SESSIONS_GC_TIME_MS = 5 * 60 * 1000
