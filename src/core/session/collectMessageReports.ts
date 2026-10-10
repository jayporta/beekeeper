import type { Result } from '../shared/result'
import type { LineScanInput } from '../transcript/feedLineScan'
import type { SkippedLineError } from '../transcript/readRecords'
import { messageTokens } from '../transcript/messageTokens'
import { assistantRecordSchema } from '../transcript/schemas'
import { recordTimestampMs } from '../transcript/summary/recordTimestampMs'
import type { AgentIdentity } from './agentIdentity'
import type { MessageReport } from './usageLedger'

/**
 * The weight, in UTF-16 code units, charged for each message report beyond
 * its strings: the report object, its token counts and its place in the list.
 */
export const MESSAGE_REPORT_OVERHEAD = 128

/** One agent's transcript, read into its message reports and a skipped-line count. */
export interface MessageReports {
  /** Every valid assistant message this agent reported, in file order. */
  readonly reports: readonly MessageReport[]
  /**
   * The number of lines that couldn't contribute a valid assistant
   * record: too long to buffer, not valid JSON, not an object, or an
   * `assistant` record that failed schema validation.
   */
  readonly skippedLines: number
}

/** Collects one agent's message reports from its transcript's lines, one at a time. */
export interface MessageReportCollector {
  /**
   * Folds in the next line of the transcript, in file order.
   * @param input - The line, as `readRecords` reports it.
   */
  observe(input: LineScanInput): void
  /**
   * What has been collected so far. `reports` is the collector's own list, so
   * lines observed later appear in it; copy it to keep a snapshot.
   */
  result(): MessageReports
  /**
   * What the collector holds, in UTF-16 code units: {@link MESSAGE_REPORT_OVERHEAD}
   * plus the length of the message id, model and speed for each report.
   */
  weight(): number
}

/**
 * Creates a collector that turns one agent's assistant records into message
 * reports, without touching the filesystem or a session's shared ledgers.
 * Every valid assistant record is a report, so a message id that appears in
 * more than one record is reported more than once; the ledger merges them.
 *
 * @param identity - The reporting agent's identity.
 * @returns A collector ready to `observe` a transcript's lines in order.
 */
export function createMessageReportCollector(identity: AgentIdentity): MessageReportCollector {
  const reports: MessageReport[] = []
  let skippedLines = 0
  let weight = 0

  return {
    observe(input) {
      if (!input.ok) {
        skippedLines += 1
        return
      }

      const record = input.value
      if (record.type !== 'assistant') return

      const parsed = assistantRecordSchema.safeParse(record)
      if (!parsed.success) {
        skippedLines += 1
        return
      }

      const { message } = parsed.data
      const speed = message.usage.speed
      reports.push({
        identity,
        messageId: message.id,
        model: message.model,
        speed,
        tokens: messageTokens(message.usage),
        timestampMs: recordTimestampMs(record)
      })
      weight +=
        MESSAGE_REPORT_OVERHEAD + message.id.length + message.model.length + (speed?.length ?? 0)
    },
    result: () => ({ reports, skippedLines }),
    weight: () => weight
  }
}

/**
 * Reads one agent's parsed transcript records into its assistant message
 * reports, without touching the filesystem or a session's shared ledgers.
 *
 * Like {@link collectAgentReports}, it either resolves with everything it
 * read or rejects with nothing applied anywhere, so a caller applies the
 * reports only after the whole transcript has been read.
 *
 * @param records - The transcript's parsed records, in file order (as `readRecords` yields).
 * @param identity - The reporting agent's identity.
 * @returns The agent's message reports and skipped-line count.
 * @throws {Error} When `records` itself throws, e.g. an unreadable file.
 */
export async function collectMessageReports(
  records: AsyncIterable<Result<Record<string, unknown>, SkippedLineError>>,
  identity: AgentIdentity
): Promise<MessageReports> {
  const collector = createMessageReportCollector(identity)
  for await (const result of records) collector.observe(result)
  return collector.result()
}
