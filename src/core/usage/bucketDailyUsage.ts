import { normalizeModelId } from '../pricing/normalizeModelId'
import { totalTokenCount } from '../pricing/totalTokenCount'
import type { LedgerEntry } from '../session/usageLedger'
import type { DailyUsageBucket, DayKey, SessionDailyUsage } from './dailyUsage'

const SYNTHETIC_MODEL = '<synthetic>'

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
    const model = normalizeModelId(entry.model)
    if (model === SYNTHETIC_MODEL) continue
    const tokens = totalTokenCount(entry.tokens)
    if (!Number.isFinite(tokens) || tokens <= 0) continue
    if (entry.earliestMs === null) {
      undatedMessages += 1
      continue
    }

    const day = dayKeyOf(entry.earliestMs)
    const key = `${day}\0${model}`
    const bucket = byKey.get(key)
    if (bucket === undefined) byKey.set(key, { day, model, tokens })
    else bucket.tokens += tokens
  }

  const buckets: DailyUsageBucket[] = [...byKey.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.model.localeCompare(b.model)
  )
  return { buckets, undatedMessages }
}
