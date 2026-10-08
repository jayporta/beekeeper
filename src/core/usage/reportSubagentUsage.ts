import { readSubagentMessageReports } from '../session/readSubagentMessageReports'
import type { UsageLedger } from '../session/usageLedger'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'

/** Options for {@link reportSubagentUsage}. */
export interface ReportSubagentUsageOptions {
  /** The subagents whose transcripts to read, in the order they own shared messages. */
  readonly subagents: readonly SubagentEntry[]
  /** The ledger the subagents' reports are applied to. */
  readonly ledger: UsageLedger
  /** Stream tuning passed through to the transcript reader, mainly for tests. */
  readonly readOptions: ReadJsonlLinesOptions
  /** Message ids another transcript owns; a subagent's report of one is ignored. Defaults to none. */
  readonly ownedElsewhere?: ReadonlySet<string>
}

/**
 * Reads subagent transcripts one at a time, in the order given, and applies
 * their message reports to a usage ledger. A transcript's reports are applied
 * only after the whole transcript has been read. A subagent that can't be
 * read is counted and skipped.
 *
 * @param options - The subagents, the ledger, any ids to ignore, and stream tuning.
 * @returns The lines that couldn't be read as records across the readable
 * subagents, and how many subagents couldn't be read.
 */
export async function reportSubagentUsage(
  options: ReportSubagentUsageOptions
): Promise<{ readonly skippedLines: number; readonly unreadableSubagents: number }> {
  const { subagents, ledger, readOptions, ownedElsewhere } = options
  let skippedLines = 0
  let unreadableSubagents = 0

  for (const subagent of subagents) {
    const read = await readSubagentMessageReports({ subagent, readOptions })
    if (!read.ok) {
      unreadableSubagents += 1
      continue
    }
    for (const report of read.value.reports) {
      if (ownedElsewhere?.has(report.messageId)) continue
      ledger.report(report)
    }
    skippedLines += read.value.skippedLines
  }

  return { skippedLines, unreadableSubagents }
}
