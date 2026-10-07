import type { LedgerEntry } from './usageLedger'

/**
 * The longest gap between two assistant messages that still counts as active
 * time: 10 minutes, the Bash tool's maximum foreground timeout. A gap between
 * messages is model time plus tool time, so a gap past this is waiting or
 * idle, not work.
 *
 * @remarks
 * An interactive lead's gaps include the time the user spent reading and
 * replying, so replies that arrive within the cutoff count as active.
 */
export const ACTIVE_GAP_CUTOFF_MS = 10 * 60 * 1000

/**
 * Sums the time an agent spent between its first and last message, leaving
 * out every gap longer than {@link ACTIVE_GAP_CUTOFF_MS}.
 *
 * @param entries - The agent's ledger entries, in any order. Entries without
 * timestamps are ignored.
 * @returns The active time in milliseconds. Time covered by overlapping
 * entries counts once.
 */
export function activeDurationMs(
  entries: readonly Pick<LedgerEntry, 'earliestMs' | 'latestMs'>[]
): number {
  const spans: { start: number; end: number }[] = []
  for (const { earliestMs, latestMs } of entries) {
    if (earliestMs !== null && latestMs !== null) spans.push({ start: earliestMs, end: latestMs })
  }
  spans.sort((a, b) => a.start - b.start)

  let activeMs = 0
  let coveredEnd: number | null = null
  for (const { start, end } of spans) {
    if (coveredEnd === null) {
      activeMs += end - start
      coveredEnd = end
      continue
    }
    const gap = start - coveredEnd
    if (gap > 0 && gap <= ACTIVE_GAP_CUTOFF_MS) activeMs += gap
    activeMs += Math.max(0, end - Math.max(start, coveredEnd))
    coveredEnd = Math.max(coveredEnd, end)
  }
  return activeMs
}
