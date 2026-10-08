import type { Result } from '../shared/result'
import type { SkippedLineError } from '../transcript/readRecords'
import { messageTokens } from '../transcript/messageTokens'
import { assistantRecordSchema } from '../transcript/schemas'
import { recordTimestampMs } from '../transcript/summary/recordTimestampMs'
import type { AgentIdentity } from './agentIdentity'
import type { MessageReport } from './usageLedger'

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
  const reports: MessageReport[] = []
  let skippedLines = 0

  for await (const result of records) {
    if (!result.ok) {
      skippedLines += 1
      continue
    }

    const record = result.value
    if (record.type !== 'assistant') continue

    const parsed = assistantRecordSchema.safeParse(record)
    if (!parsed.success) {
      skippedLines += 1
      continue
    }

    const { message } = parsed.data
    reports.push({
      identity,
      messageId: message.id,
      model: message.model,
      speed: message.usage.speed,
      tokens: messageTokens(message.usage),
      timestampMs: recordTimestampMs(record)
    })
  }

  return { reports, skippedLines }
}
