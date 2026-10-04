/**
 * How long a folder's totals count as fresh, in milliseconds: 5 minutes. A
 * totals request reads every session in the window, so a window focus within
 * this time of the last fetch refetches nothing, and the sidebar's figures
 * and the overview's cards, which read the same queries, don't rescan the
 * folders each time the app is switched back to.
 */
export const TOTALS_STALE_TIME_MS = 5 * 60 * 1000
