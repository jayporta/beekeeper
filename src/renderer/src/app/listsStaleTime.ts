/**
 * How long a project or session list counts as fresh, in milliseconds. A
 * window focus within this time of the last fetch refetches nothing, so
 * switching back and forth between apps doesn't rescan the folders each time.
 */
export const LISTS_STALE_TIME_MS = 10_000
