import type { SkippedLineError } from '../transcript/readRecords'
import type { Result } from '../transcript/result'
import { assistantRecordSchema } from '../transcript/schemas'
import type { AgentIdentity } from './agentIdentity'
import { createFileTouchCollector, type FileTouch } from './fileTouchCollector'
import { messageTokens } from './messageTokens'
import type { MessageReport } from './usageLedger'

/** One agent's transcript, read into its message reports, file touches, and a skipped-line count. */
export interface AgentReports {
  /** Every valid assistant message this agent reported, in file order. */
  readonly reports: readonly MessageReport[]
  /** Every file this agent's `Edit`/`Write` tool calls touched, in file order. */
  readonly fileTouches: readonly FileTouch[]
  /**
   * The number of lines that couldn't contribute a valid assistant
   * record: too long to buffer, not valid JSON, not an object, or an
   * `assistant` record that failed schema validation.
   */
  readonly skippedLines: number
}

/**
 * Reads one agent's parsed transcript records into its message reports and
 * file touches, without touching the filesystem or a session's shared
 * ledgers.
 *
 * Keeping this apart from the ledgers lets a caller apply an agent's
 * reports only after its whole transcript has been read successfully, so
 * a read that fails partway through never leaves a partial set of
 * messages or touches already credited to that agent: this function
 * either resolves with everything it read, or rejects with nothing
 * applied anywhere. Every record is also fed to a {@link FileTouchCollector}
 * in the same pass, so the transcript is scanned only once.
 *
 * @param records - The transcript's parsed records, in file order (as `readRecords` yields).
 * @param identity - The reporting agent's identity.
 * @returns The agent's message reports, file touches, and skipped-line count.
 * @throws {Error} When `records` itself throws, e.g. an unreadable file.
 */
export async function collectAgentReports(
  records: AsyncIterable<Result<Record<string, unknown>, SkippedLineError>>,
  identity: AgentIdentity
): Promise<AgentReports> {
  const reports: MessageReport[] = []
  const fileTouchCollector = createFileTouchCollector()
  let skippedLines = 0

  for await (const result of records) {
    if (!result.ok) {
      skippedLines += 1
      continue
    }

    const record = result.value
    fileTouchCollector.observe(record)

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
      tokens: messageTokens(message.usage)
    })
  }

  return { reports, fileTouches: fileTouchCollector.touches(), skippedLines }
}
