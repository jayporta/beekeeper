/**
 * The query roots that hold a folder's whole-folder reads: its totals and its
 * daily usage. They share a stale time and are refreshed apart from the lists.
 */
export const TOTALS_ROOTS: readonly unknown[] = ['projectTotals', 'projectDailyUsage']
