import { activeDurationMs } from './activeDurationMs'
import { agentIdentityKey, type AgentIdentity } from './agentIdentity'
import type { AgentUsage } from './agentUsage'
import type { AgentReports } from './collectAgentReports'
import type { FileTouch } from './fileTouchCollector'
import type { FileTouchEntry, FilesLedger } from './filesLedger'
import type { AgentSignals } from '../transcript/signals/agentSignals'
import { summarizeSignals } from '../transcript/signals/summarizeSignals'
import type { SignalEntry, SignalsLedger } from './signalsLedger'
import { groupTokensByModelAndSpeed } from './tokenGroup'
import type { LedgerEntry, UsageLedger } from './usageLedger'

/** One agent's usage, file touches and signals, scanned from its transcript. */
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
  /**
   * The span of the agent's own assistant messages, from the earliest
   * timestamp to the latest, and the active time within it, or `null` when
   * none of them has a usable timestamp. Messages credited to another agent,
   * such as a fork's copy of the lead's history, don't count.
   */
  readonly activity: AgentActivity | null
  /**
   * The agent's signal counts, from the events it owns: the ones its transcript
   * reported first. A fork's copy of the lead's history belongs to the lead, so
   * it adds nothing here, and a run that spans the copied part is counted only
   * over the fork's own events.
   */
  readonly signals: AgentSignals
}

/** The span between an agent's first and last timestamped assistant messages, and the active time within it. */
export interface AgentActivity {
  /** The earliest message timestamp, in epoch milliseconds. */
  readonly earliestMs: number
  /** The latest message timestamp, in epoch milliseconds. */
  readonly latestMs: number
  /** The time between its messages, in milliseconds, with every gap past the cutoff described at {@link activeDurationMs} left out. */
  readonly activeMs: number
}

/** Input for {@link applyAgentReports}. */
export interface ApplyAgentReportsInput {
  /** The session's shared usage ledger. */
  readonly usageLedger: UsageLedger
  /** The session's shared files ledger. */
  readonly filesLedger: FilesLedger
  /** The session's shared signals ledger. */
  readonly signalsLedger: SignalsLedger
  /** The agent whose reports are applied. */
  readonly identity: AgentIdentity
  /** What the agent's transcript reported. */
  readonly agentReports: AgentReports
}

/**
 * Applies one agent's already-read reports to the session's shared ledgers.
 * Each ledger credits a shared id to the first agent that reports it.
 * @param input - The ledgers, the agent, and what its transcript reported.
 */
export function applyAgentReports(input: ApplyAgentReportsInput): void {
  const { usageLedger, filesLedger, signalsLedger, identity, agentReports } = input
  for (const report of agentReports.reports) usageLedger.report(report)
  for (const touch of agentReports.fileTouches) filesLedger.report({ identity, touch })
  for (const toolUseId of agentReports.incompleteToolUseIds) {
    filesLedger.reportIncomplete({ identity, toolUseId })
  }
  if (agentReports.incompleteOverflowed) filesLedger.markIncomplete(identity)
  for (const event of agentReports.signalEvents) signalsLedger.report({ identity, event })
  if (agentReports.signalsCapped) signalsLedger.markCapped(identity)
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
  /** The signals ledger's entries, grouped by owner. */
  readonly signalsByOwner: ReadonlyMap<string, readonly SignalEntry[]>
  /** The identity keys of the agents whose signal events were dropped at a cap. */
  readonly signalsCappedOwners: ReadonlySet<string>
  /** How many lines of the agent's transcript could not be read. */
  readonly skippedLines: number
}

/**
 * Finds the span of the timestamps across an agent's ledger entries, and its
 * active time.
 * @param entries - The entries the agent owns.
 * @returns The span and active time, or `null` when no entry has a timestamp.
 */
function activityOf(entries: readonly LedgerEntry[]): AgentActivity | null {
  let earliestMs: number | null = null
  let latestMs: number | null = null
  for (const entry of entries) {
    if (entry.earliestMs !== null && (earliestMs === null || entry.earliestMs < earliestMs)) {
      earliestMs = entry.earliestMs
    }
    if (entry.latestMs !== null && (latestMs === null || entry.latestMs > latestMs)) {
      latestMs = entry.latestMs
    }
  }
  return earliestMs === null || latestMs === null
    ? null
    : { earliestMs, latestMs, activeMs: activeDurationMs(entries) }
}

/**
 * Builds one agent's report from the ledger entries it owns.
 * @param input - The agent's identity, the grouped ledgers, and its
 * transcript's skipped-line count.
 * @returns The agent's usage, file touches, activity span and signals.
 */
export function buildAgentReport(input: BuildAgentReportInput): AgentReport {
  const {
    identity,
    usageByOwner,
    touchesByOwner,
    incompleteOwners,
    signalsByOwner,
    signalsCappedOwners,
    skippedLines
  } = input
  const key = agentIdentityKey(identity)
  const owned = usageByOwner.get(key) ?? []

  const ownedTouches = touchesByOwner.get(key) ?? []
  const ownedSignals = signalsByOwner.get(key) ?? []

  return {
    usage: {
      tokenGroups: groupTokensByModelAndSpeed(owned),
      messageCount: owned.length,
      skippedLines
    },
    fileTouches: ownedTouches.map((entry) => entry.touch),
    fileListIncomplete: incompleteOwners.has(key),
    activity: activityOf(owned),
    signals: summarizeSignals(
      ownedSignals.map((entry) => entry.event),
      { partial: signalsCappedOwners.has(key) }
    )
  }
}
