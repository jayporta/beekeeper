import type { AgentIdentity } from './agentIdentity'
import type { FileTouch } from './fileTouchCollector'

/** One file touch as tracked by the files ledger. */
export interface FileTouchEntry {
  /** The agent that owns this touch: the first one to report its tool use id. */
  readonly owner: AgentIdentity
  /** The touch itself. */
  readonly touch: FileTouch
}

/** One agent's report of a file touch. */
export interface FileTouchReport {
  /** The reporting agent. */
  readonly identity: AgentIdentity
  /** The touch being reported. */
  readonly touch: FileTouch
}

/**
 * Tracks file touches across every agent's transcript in one session, so a
 * touch forked into more than one transcript (a subagent copying the
 * lead's context) is credited to exactly one agent: whichever reports its
 * `toolUseId` first.
 */
export interface FilesLedger {
  /**
   * Records one agent's report of a file touch. The first report of a
   * `toolUseId` becomes its owner; a later report of the same id, from any
   * agent, changes nothing.
   */
  report(fileTouchReport: FileTouchReport): void
  /** Every touch the ledger has seen, in first-reported order. */
  entries(): readonly FileTouchEntry[]
}

/**
 * Creates an empty {@link FilesLedger}.
 * @returns A new, empty ledger.
 */
export function createFilesLedger(): FilesLedger {
  const byToolUseId = new Map<string, FileTouchEntry>()

  return {
    report({ identity, touch }) {
      if (byToolUseId.has(touch.toolUseId)) return
      byToolUseId.set(touch.toolUseId, { owner: identity, touch })
    },
    entries() {
      return [...byToolUseId.values()]
    }
  }
}
