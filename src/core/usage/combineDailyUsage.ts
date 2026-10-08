import { QUARTER_HOUR_MS } from '../shared/quarterHour'
import type { LeadUsage } from '../transcript/summary/leadUsage'
import { compareDailyUsageBuckets } from './compareDailyUsageBuckets'
import type { DailyUsageBucket, DayKey, SessionDailyUsage } from './dailyUsage'

/** Options for {@link combineDailyUsage}. */
export interface CombineDailyUsageOptions {
  /** The lead transcript's usage by quarter-hour slot. */
  readonly lead: LeadUsage
  /** The lead summary's `skippedLines`. */
  readonly leadSkippedLines: number
  /** The subagents' daily usage, with the lead's messages already left out. */
  readonly subagents: SessionDailyUsage
  /** Maps an instant, in epoch milliseconds, to its local day. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Merges the lead's quarter-hour slots and the subagents' daily buckets into
 * one session's daily usage. A slot lies wholly within one local day, so it
 * maps to a day by its start instant. Tokens on the same day and model sum,
 * and the buckets sort by day then model.
 *
 * @param options - The lead usage, the subagent usage, and the day mapping.
 * @returns The session's daily usage and what couldn't be counted. Its
 * `skippedLines` also include the lead's `assistant` records that failed validation.
 */
export function combineDailyUsage(options: CombineDailyUsageOptions): SessionDailyUsage {
  const { lead, leadSkippedLines, subagents, dayKeyOf } = options
  const byKey = new Map<string, DailyUsageBucket>()

  const add = (day: DayKey, model: string, tokens: number): void => {
    const key = `${day}\0${model}`
    const bucket = byKey.get(key)
    byKey.set(key, { day, model, tokens: (bucket?.tokens ?? 0) + tokens })
  }
  for (const slot of lead.slots) add(dayKeyOf(slot.slot * QUARTER_HOUR_MS), slot.model, slot.tokens)
  for (const bucket of subagents.buckets) add(bucket.day, bucket.model, bucket.tokens)

  return {
    buckets: [...byKey.values()].sort(compareDailyUsageBuckets),
    undatedMessages: lead.undatedMessages + subagents.undatedMessages,
    skippedLines: leadSkippedLines + lead.invalidAssistantRecords + subagents.skippedLines,
    unreadableSubagents: subagents.unreadableSubagents
  }
}
