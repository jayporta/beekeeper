import { agentIdentityKey, type AgentIdentity } from './agentIdentity'
import type { FileTouch } from './fileTouchCollector'

/**
 * The most Bash touches one session's ledger keeps, across every agent. The
 * collector caps each transcript, but a session can hold any number of
 * subagent transcripts, so without a total a crafted one could still make
 * millions of touches. Real sessions name a few hundred files at most. A Bash
 * touch past the cap is not kept, and the agent that reported it is marked
 * incomplete.
 */
export const MAX_BASH_TOUCHES_PER_SESSION = 16_384

/**
 * The most incomplete results the ledger remembers by tool use id, to tell a
 * fork's copy of a result from a new one. Past it the owner is marked
 * incomplete without the id being kept, so a copy in a fork may mark its agent
 * too, which errs toward reporting the list as incomplete.
 */
export const MAX_INCOMPLETE_RESULTS_PER_SESSION = 16_384

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

/** One agent's report that a tool result's changed-file list may be missing files. */
export interface IncompleteReport {
  /** The reporting agent. */
  readonly identity: AgentIdentity
  /** The `tool_use_id` of the result with the possibly incomplete list. */
  readonly toolUseId: string
}

/**
 * Tracks file touches across every agent's transcript in one session, so a
 * touch forked into more than one transcript (a subagent copying the
 * lead's context) is credited to exactly one agent: whichever reports its
 * `toolUseId` first owns every touch of it. A single tool use can touch
 * several files (a Bash command), so the owner may report several paths, each
 * kept once.
 */
export interface FilesLedger {
  /**
   * Records one agent's report of a file touch. The first agent to report a
   * `toolUseId` owns it; a touch of that id from any other agent changes
   * nothing, and neither does a repeat of a path the owner already reported.
   * A Bash touch past {@link MAX_BASH_TOUCHES_PER_SESSION} is not kept, records
   * no owner for a new `toolUseId`, and marks the reporting agent incomplete.
   */
  report(fileTouchReport: FileTouchReport): void
  /** Every touch the ledger has seen, in first-reported order. */
  entries(): readonly FileTouchEntry[]
  /**
   * Records one agent's report that a result's changed-file list may be
   * incomplete. The first report of a `toolUseId` decides which agent owns it.
   */
  reportIncomplete(report: IncompleteReport): void
  /** Marks an agent's file list incomplete outright, with no result to match against a fork's copy. */
  markIncomplete(identity: AgentIdentity): void
  /** The agents whose file list may be missing files, each once, in first-marked order. */
  incompleteOwners(): readonly AgentIdentity[]
}

/**
 * Creates an empty {@link FilesLedger}.
 * @returns A new, empty ledger.
 */
export function createFilesLedger(): FilesLedger {
  const byTouchKey = new Map<string, FileTouchEntry>()
  const ownerByToolUseId = new Map<string, AgentIdentity>()
  const incompleteToolUseIds = new Set<string>()
  const incompleteByOwner = new Map<string, AgentIdentity>()
  let bashTouchCount = 0

  function markIncomplete(identity: AgentIdentity): void {
    const key = agentIdentityKey(identity)
    if (!incompleteByOwner.has(key)) incompleteByOwner.set(key, identity)
  }

  return {
    report({ identity, touch }) {
      const owner = ownerByToolUseId.get(touch.toolUseId)
      if (owner !== undefined && agentIdentityKey(owner) !== agentIdentityKey(identity)) return

      const key = `${touch.toolUseId}\0${touch.filePath}`
      if (byTouchKey.has(key)) return
      if (touch.source === 'bash') {
        if (bashTouchCount >= MAX_BASH_TOUCHES_PER_SESSION) {
          markIncomplete(identity)
          return
        }
        bashTouchCount += 1
      }
      if (owner === undefined) ownerByToolUseId.set(touch.toolUseId, identity)
      byTouchKey.set(key, { owner: identity, touch })
    },
    entries() {
      return [...byTouchKey.values()]
    },
    reportIncomplete({ identity, toolUseId }) {
      if (incompleteToolUseIds.has(toolUseId)) return
      if (incompleteToolUseIds.size < MAX_INCOMPLETE_RESULTS_PER_SESSION) {
        incompleteToolUseIds.add(toolUseId)
      }
      markIncomplete(identity)
    },
    markIncomplete,
    incompleteOwners() {
      return [...incompleteByOwner.values()]
    }
  }
}
