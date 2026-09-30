import { agentIdentityKey, type AgentIdentity } from './agentIdentity'
import type { AgentUsage } from './agentUsage'
import type { AgentReports } from './collectAgentReports'
import type { FileTouch } from './fileTouchCollector'
import type { FileTouchEntry, FilesLedger } from './filesLedger'
import { groupTokensByModelAndSpeed } from './tokenGroup'
import type { LedgerEntry, UsageLedger } from './usageLedger'

/** One agent's usage and file touches, scanned from its transcript. */
export interface AgentReport {
  /** The agent's token usage. */
  readonly usage: AgentUsage
  /** The files the agent's `Edit`/`Write` calls and Bash results touched. */
  readonly fileTouches: readonly FileTouch[]
  /**
   * Whether the file list may be missing files: one of the agent's Bash
   * results said it could not tell what its command changed (`unavailable`,
   * `shared`, or `skipped`), named more paths than the per-result cap, named
   * a path that could not be listed, or gave no usable `changedFiles`; or the
   * agent's Bash touches passed the per-transcript or per-session cap, or its
   * incomplete results outnumbered the transcript's limit on remembered ones.
   * It can also over-report: a fork's transcript holds copies of the lead's
   * incomplete results, which count toward its own limit, so a fork that
   * copied past it is marked even if none were its own; past the session's
   * limit on remembered incomplete results, a fork's copy of one marks the
   * fork too; and a lead touch cut at the per-session cap has no owner, so a
   * fork's copy of it is cut as well and marks the fork. Not set when a
   * result only truncated its hunks.
   */
  readonly fileListIncomplete: boolean
}

/** Input for {@link applyAgentReports}. */
export interface ApplyAgentReportsInput {
  /** The session's shared usage ledger. */
  readonly usageLedger: UsageLedger
  /** The session's shared files ledger. */
  readonly filesLedger: FilesLedger
  /** The agent whose reports are applied. */
  readonly identity: AgentIdentity
  /** What the agent's transcript reported. */
  readonly agentReports: AgentReports
}

/**
 * Applies one agent's already-read reports to the session's shared ledgers.
 * @param input - The ledgers, the agent, and what its transcript reported.
 */
export function applyAgentReports(input: ApplyAgentReportsInput): void {
  const { usageLedger, filesLedger, identity, agentReports } = input
  for (const report of agentReports.reports) usageLedger.report(report)
  for (const touch of agentReports.fileTouches) filesLedger.report({ identity, touch })
  for (const toolUseId of agentReports.incompleteToolUseIds) {
    filesLedger.reportIncomplete({ identity, toolUseId })
  }
  if (agentReports.incompleteOverflowed) filesLedger.markIncomplete(identity)
}

/** Input for {@link buildAgentReport}. */
export interface BuildAgentReportInput {
  /** The agent to report on. */
  readonly identity: AgentIdentity
  /** The usage ledger's entries, grouped by owner. */
  readonly usageByOwner: ReadonlyMap<string, readonly LedgerEntry[]>
  /** The files ledger's entries, grouped by owner. */
  readonly touchesByOwner: ReadonlyMap<string, readonly FileTouchEntry[]>
  /** The identity keys of the agents that own a possibly incomplete Bash result. */
  readonly incompleteOwners: ReadonlySet<string>
  /** How many lines of the agent's transcript could not be read. */
  readonly skippedLines: number
}

/**
 * Builds one agent's report from the ledger entries it owns.
 * @param input - The agent's identity, the grouped ledgers, and its
 * transcript's skipped-line count.
 * @returns The agent's usage and file touches.
 */
export function buildAgentReport(input: BuildAgentReportInput): AgentReport {
  const { identity, usageByOwner, touchesByOwner, incompleteOwners, skippedLines } = input
  const key = agentIdentityKey(identity)
  const owned = usageByOwner.get(key) ?? []

  const ownedTouches = touchesByOwner.get(key) ?? []

  return {
    usage: {
      tokenGroups: groupTokensByModelAndSpeed(owned),
      messageCount: owned.length,
      skippedLines
    },
    fileTouches: ownedTouches.map((entry) => entry.touch),
    fileListIncomplete: incompleteOwners.has(key)
  }
}
