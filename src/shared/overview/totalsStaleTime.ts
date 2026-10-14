/**
 * How long a folder's totals count as fresh, in milliseconds: 5 minutes. A
 * totals request reads every session in the window, so a host refreshes a
 * folder's totals no more often than this.
 */
export const TOTALS_STALE_TIME_MS = 5 * 60 * 1000
