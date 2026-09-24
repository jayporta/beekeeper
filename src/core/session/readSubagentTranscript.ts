import { captureSystemError } from '../transcript/captureSystemError'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'
import { readRecords } from '../transcript/readRecords'
import type { Result } from '../transcript/result'
import type { UnreadableError } from '../transcript/unreadableError'
import { subagentIdentity } from './agentIdentity'
import { collectAgentReports, type AgentReports } from './collectAgentReports'
import { tapRecords } from './tapRecords'

/** Options for {@link readSubagentTranscript}. */
export interface ReadSubagentTranscriptOptions {
  /** The subagent whose transcript to read. */
  readonly subagent: SubagentEntry
  /** Stream tuning passed through to the transcript reader, mainly for tests. */
  readonly readOptions: ReadJsonlLinesOptions
  /** Shown each valid record in the same pass that reads the transcript. */
  readonly observe: (record: Record<string, unknown>) => void
}

/**
 * Reads one subagent's transcript into its message reports and file
 * touches, isolating a failed read as a {@link Result} instead of letting
 * it fail the whole session scan.
 *
 * @param options - The subagent to read, any stream tuning, and an
 * observer of its records.
 * @returns `ok` with everything the transcript reported, or `err` when the
 * transcript could not be read.
 * @throws {Error} When the read fails for a reason that carries no system
 * error code, since that indicates a bug rather than an unreadable file.
 */
export async function readSubagentTranscript(
  options: ReadSubagentTranscriptOptions
): Promise<Result<AgentReports, UnreadableError>> {
  const { subagent, readOptions, observe } = options
  const identity = subagentIdentity(subagent.agentId)

  return captureSystemError(() =>
    collectAgentReports(
      tapRecords(readRecords(subagent.transcript.path, readOptions), observe),
      identity
    )
  )
}
