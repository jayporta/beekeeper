import { countedUsage } from '../pricing/countedUsage'
import type { LedgerEntry } from '../session/usageLedger'
import { compareDailyUsageBuckets } from './compareDailyUsageBuckets'
import type { DailyUsageBucket, DayKey, SessionDailyUsage } from './dailyUsage'

/**
 * Groups usage ledger entries into (day, model) buckets, counting each
 * message on the day of its earliest record.
 *
 * Messages from the `<synthetic>` model, with no tokens, or with a
 * non-finite token total are left out. A message with tokens but no
 * timestamp is counted in `undatedMessages` instead of a bucket.
 *
 * @param entries - The ledger's entries for one session.
 * @param dayKeyOf - Maps an instant, in epoch milliseconds, to its local day.
 * @returns The buckets sorted by day then model, and the undated message count.
 */
export function bucketDailyUsage(
  entries: readonly LedgerEntry[],
  dayKeyOf: (epochMs: number) => DayKey
): Pick<SessionDailyUsage, 'buckets' | 'undatedMessages'> {
  const byKey = new Map<string, { day: DayKey; model: string; tokens: number }>()
  let undatedMessages = 0

  for (const entry of entries) {
    const counted = countedUsage(entry)
    if (counted === null) continue
    if (entry.earliestMs === null) {
      undatedMessages += 1
      continue
    }

    const day = dayKeyOf(entry.earliestMs)
    const key = `${day}\0${counted.model}`
    const bucket = byKey.get(key)
    if (bucket === undefined) byKey.set(key, { day, model: counted.model, tokens: counted.tokens })
    else bucket.tokens += counted.tokens
  }

  const buckets: DailyUsageBucket[] = [...byKey.values()].sort(compareDailyUsageBuckets)
  return { buckets, undatedMessages }
}
