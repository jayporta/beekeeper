import type { Result } from '../shared/result'
import type { SkippedLineError } from '../transcript/readRecords'
import type { SignalEvent } from '../transcript/signals/signalEvent'
import { createSignalObserver } from '../transcript/signals/signalObserver'
import type { AgentIdentity } from './agentIdentity'
import { combineObservers } from './combineObservers'
import { collectMessageReports, type MessageReports } from './collectMessageReports'
import { createFileTouchCollector, type FileTouch } from './fileTouchCollector'
import { tapRecords } from './tapRecords'

/** One agent's transcript, read into its message reports, file touches, signal events, and a skipped-line count. */
export interface AgentReports extends MessageReports {
  /** Every file this agent's `Edit`/`Write` calls and Bash results touched, in file order. */
  readonly fileTouches: readonly FileTouch[]
  /** The `tool_use_id` of each Bash result whose changed-file list may be missing files, in file order. */
  readonly incompleteToolUseIds: readonly string[]
  /** Whether an incomplete Bash result arrived after the id list was full, so the agent's list is incomplete outright. */
  readonly incompleteOverflowed: boolean
  /** The signal events the transcript holds, in file order, up to the per-transcript cap. */
  readonly signalEvents: readonly SignalEvent[]
  /** Whether the transcript held more signal events than the cap, so the agent's signals are partial. */
  readonly signalsCapped: boolean
}

/**
 * Reads one agent's parsed transcript records into its message reports,
 * file touches and signal events, without touching the filesystem or a session's shared
 * ledgers.
 *
 * Keeping this apart from the ledgers lets a caller apply an agent's
 * reports only after its whole transcript has been read successfully, so
 * a read that fails partway through never leaves a partial set of
 * messages or touches already credited to that agent: this function
 * either resolves with everything it read, or rejects with nothing
 * applied anywhere. Every record is also fed to a {@link FileTouchCollector}
 * and a signal observer in the same pass, so the transcript is scanned only
 * once. The signal observer is not part of {@link collectMessageReports}, so
 * the overview and daily-usage scans don't pay for it.
 *
 * @param records - The transcript's parsed records, in file order (as `readRecords` yields).
 * @param identity - The reporting agent's identity.
 * @returns The agent's message reports, file touches, signal events, and skipped-line count.
 * @throws {Error} When `records` itself throws, e.g. an unreadable file.
 */
export async function collectAgentReports(
  records: AsyncIterable<Result<Record<string, unknown>, SkippedLineError>>,
  identity: AgentIdentity
): Promise<AgentReports> {
  const fileTouchCollector = createFileTouchCollector()
  const signalObserver = createSignalObserver()
  const { reports, skippedLines } = await collectMessageReports(
    tapRecords(records, combineObservers(fileTouchCollector.observe, signalObserver.observe)),
    identity
  )

  return {
    reports,
    fileTouches: fileTouchCollector.touches(),
    incompleteToolUseIds: fileTouchCollector.incompleteToolUseIds(),
    incompleteOverflowed: fileTouchCollector.incompleteOverflowed(),
    signalEvents: signalObserver.events(),
    signalsCapped: signalObserver.capped(),
    skippedLines
  }
}
