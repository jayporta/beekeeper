import type { Result } from '../shared/result'
import { captureSystemError } from '../transcript/captureSystemError'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'
import { readRecords } from '../transcript/readRecords'
import type { UnreadableError } from '../transcript/unreadableError'
import { subagentIdentity } from './agentIdentity'
import { collectMessageReports, type MessageReports } from './collectMessageReports'

/** Options for {@link readSubagentMessageReports}. */
export interface ReadSubagentMessageReportsOptions {
  /** The subagent whose transcript to read. */
  readonly subagent: SubagentEntry
  /** Stream tuning passed through to the transcript reader, mainly for tests. */
  readonly readOptions: ReadJsonlLinesOptions
}

/**
 * Reads one subagent's transcript into its assistant message reports only,
 * isolating a failed read as a {@link Result}. Unlike
 * {@link readSubagentTranscript}, it collects no file touches, for callers
 * that need only usage.
 *
 * @param options - The subagent to read and any stream tuning.
 * @returns `ok` with the messages the transcript reported, or `err` when
 * the transcript could not be read.
 * @throws {Error} When the read fails for a reason that carries no system
 * error code, since that indicates a bug rather than an unreadable file.
 */
export async function readSubagentMessageReports(
  options: ReadSubagentMessageReportsOptions
): Promise<Result<MessageReports, UnreadableError>> {
  const { subagent, readOptions } = options

  return captureSystemError(() =>
    collectMessageReports(
      readRecords(subagent.transcript.path, readOptions),
      subagentIdentity(subagent.agentId)
    )
  )
}
