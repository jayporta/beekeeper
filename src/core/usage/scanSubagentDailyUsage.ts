import { createUsageLedger } from '../session/usageLedger'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'
import { bucketDailyUsage } from './bucketDailyUsage'
import type { DayKey, SessionDailyUsage } from './dailyUsage'
import { reportSubagentUsage } from './reportSubagentUsage'

/** The daily usage of a session with no subagents: no buckets and nothing uncounted. */
export const EMPTY_SUBAGENT_DAILY_USAGE: SessionDailyUsage = {
  buckets: [],
  undatedMessages: 0,
  skippedLines: 0,
  unreadableSubagents: 0
}

/** Options for {@link scanSubagentDailyUsage}. */
export interface ScanSubagentDailyUsageOptions extends ReadJsonlLinesOptions {
  /** The session's subagents, read one at a time in this order. */
  readonly subagents: readonly SubagentEntry[]
  /** Every message id the lead transcript reported, counted or not. A subagent's report of one is ignored. */
  readonly leadMessageIds: ReadonlySet<string>
  /** Maps an instant, in epoch milliseconds, to its local day. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Reads a session's subagent transcripts into their tokens by day and model,
 * leaving out every message the lead reported, since the lead owns those. A
 * message two subagents both report belongs to the one earlier in
 * `subagents`, as in the session scan's usage ledger.
 *
 * @param options - The subagents, the lead's message ids, the day mapping, and any stream tuning.
 * @returns The subagents' daily usage and what couldn't be counted.
 */
export async function scanSubagentDailyUsage(
  options: ScanSubagentDailyUsageOptions
): Promise<SessionDailyUsage> {
  const { subagents, leadMessageIds, dayKeyOf, ...readOptions } = options
  const ledger = createUsageLedger()
  const { skippedLines, unreadableSubagents } = await reportSubagentUsage({
    subagents,
    ledger,
    readOptions,
    ownedElsewhere: leadMessageIds
  })

  return { ...bucketDailyUsage(ledger.entries(), dayKeyOf), skippedLines, unreadableSubagents }
}
