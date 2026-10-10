import type { LineScan } from '../transcript/feedLineScan'
import type { SignalEvent } from '../transcript/signals/signalEvent'
import { createSignalObserver } from '../transcript/signals/signalObserver'
import type { AgentIdentity } from './agentIdentity'
import { createMessageReportCollector, type MessageReports } from './collectMessageReports'
import { createFileTouchCollector, type FileTouch } from './fileTouchCollector'

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

/** Folds one agent's transcript lines into its {@link AgentReports}, one line at a time. */
export interface AgentReportsFold extends LineScan {
  /**
   * What has been folded so far, in lists of its own that later lines never
   * change.
   */
  snapshot(): AgentReports
  /**
   * What the fold holds, in UTF-16 code units: its message reports, file
   * touches and signal events together.
   */
  weight(): number
}

/**
 * Creates a fold that reads one agent's parsed transcript lines into its
 * message reports, file touches and signal events, without touching the
 * filesystem or a session's shared ledgers. Every line is fed to a file touch
 * collector, a signal observer and a message report collector in the same
 * pass, so the transcript is scanned only once. The signal observer is not
 * part of the message reports, so the overview and daily-usage scans don't
 * pay for it.
 *
 * Feeding it a file's lines in order gives the reports of the whole file, and
 * feeding it the lines after those it has already seen gives the same reports
 * as a scan of the longer file from the start.
 *
 * @param identity - The reporting agent's identity.
 * @returns A fold with nothing observed.
 */
export function createAgentReportsFold(identity: AgentIdentity): AgentReportsFold {
  const fileTouchCollector = createFileTouchCollector()
  const signalObserver = createSignalObserver()
  const messageReports = createMessageReportCollector(identity)

  return {
    observe(input) {
      if (input.ok) {
        fileTouchCollector.observe(input.value)
        signalObserver.observe(input.value)
      }
      messageReports.observe(input)
    },
    snapshot() {
      const { reports, skippedLines } = messageReports.result()
      return {
        reports: [...reports],
        skippedLines,
        fileTouches: [...fileTouchCollector.touches()],
        incompleteToolUseIds: [...fileTouchCollector.incompleteToolUseIds()],
        incompleteOverflowed: fileTouchCollector.incompleteOverflowed(),
        signalEvents: [...signalObserver.events()],
        signalsCapped: signalObserver.capped()
      }
    },
    weight: () => messageReports.weight() + fileTouchCollector.weight() + signalObserver.weight()
  }
}
