import { leadIdentity } from '../session/agentIdentity'
import { collectMessageReports } from '../session/collectMessageReports'
import { readSubagentMessageReports } from '../session/readSubagentMessageReports'
import { createUsageLedger } from '../session/usageLedger'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'
import { readRecords } from '../transcript/readRecords'
import { bucketDailyUsage } from './bucketDailyUsage'
import type { DayKey, SessionDailyUsage } from './dailyUsage'

/** Options for {@link scanSessionDailyUsage}. */
export interface ScanSessionDailyUsageOptions extends ReadJsonlLinesOptions {
  /** Absolute path to the session's lead transcript. */
  readonly leadPath: string
  /** The session's subagents, whose transcripts are read after the lead's. */
  readonly subagents: readonly SubagentEntry[]
  /** Maps an instant, in epoch milliseconds, to its local day. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Reads one session's lead and subagent transcripts into its tokens by day
 * and model. A message a subagent repeats from the lead's context counts
 * once, for the lead, as in the session scan's usage ledger.
 *
 * @param options - The transcripts to read, the day mapping, and any stream tuning.
 * @returns The session's daily usage and what couldn't be counted.
 * @throws {Error} When the lead transcript can't be read.
 */
export async function scanSessionDailyUsage(
  options: ScanSessionDailyUsageOptions
): Promise<SessionDailyUsage> {
  const { leadPath, subagents, dayKeyOf, ...readOptions } = options
  const ledger = createUsageLedger()

  const lead = await collectMessageReports(readRecords(leadPath, readOptions), leadIdentity)
  for (const report of lead.reports) ledger.report(report)
  let skippedLines = lead.skippedLines
  let unreadableSubagents = 0

  for (const subagent of subagents) {
    const read = await readSubagentMessageReports({ subagent, readOptions })
    if (!read.ok) {
      unreadableSubagents += 1
      continue
    }
    // Applied only after the whole transcript has been read, as scanSession does.
    for (const report of read.value.reports) ledger.report(report)
    skippedLines += read.value.skippedLines
  }

  return { ...bucketDailyUsage(ledger.entries(), dayKeyOf), skippedLines, unreadableSubagents }
}
