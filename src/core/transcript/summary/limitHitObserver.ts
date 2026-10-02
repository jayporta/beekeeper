import { quotaLimitsRecordSchema } from '../schemas'
import type { LimitHit } from './sessionSummary'

const WINDOWS = { five_hour: 'fiveHour', seven_day: 'sevenDay' } as const

/** Tracks the plan-limit hit with the latest reset among the records it observes. */
export interface LimitHitObserver {
  /**
   * Feeds one parsed record, in any order. Records without a valid `quotaLimits` are ignored.
   * @param record - The parsed record.
   */
  observe(record: Record<string, unknown>): void
  /** The hit with the largest reset, or `null` if none. */
  latest(): LimitHit | null
}

/**
 * Creates an observer that keeps the plan-limit hit with the largest reset
 * time. Timestamps within a transcript can run backwards, so line order
 * can't say which hit is latest, and the latest reset is the one that
 * matters. Sidechain records count, since every agent in a session shares
 * the account. On a tie the first hit seen wins.
 *
 * @returns An observer ready to `observe` a transcript's records.
 */
export function createLimitHitObserver(): LimitHitObserver {
  let hit: LimitHit | null = null

  return {
    observe(record) {
      if (!('quotaLimits' in record)) return
      const parsed = quotaLimitsRecordSchema.safeParse(record)
      if (!parsed.success) return

      const { rateLimitType, resetsAt } = parsed.data.quotaLimits
      const resetsAtMs = resetsAt * 1000
      if (hit !== null && resetsAtMs <= hit.resetsAtMs) return
      hit = { window: WINDOWS[rateLimitType], resetsAtMs }
    },
    latest: () => hit
  }
}
