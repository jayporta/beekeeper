import { captureSystemError } from '../transcript/captureSystemError'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { AgentId } from '../transcript/ids'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'
import { readRecords } from '../transcript/readRecords'
import { ok, type Result } from '../transcript/result'
import type { UnreadableError } from '../transcript/unreadableError'
import { agentIdentityKey, leadIdentity, subagentIdentity } from './agentIdentity'
import type { AgentUsage } from './agentUsage'
import { collectAgentReports, type AgentReports } from './collectAgentReports'
import { groupTokensByModelAndSpeed } from './tokenGroup'
import { createUsageLedger, type LedgerEntry } from './usageLedger'

/** Options for {@link scanSessionUsage}. */
export interface ScanSessionUsageOptions extends ReadJsonlLinesOptions {
  /** Absolute path to the session's lead transcript. */
  readonly leadPath: string
  /** The session's subagent transcripts, scanned after the lead, in order. */
  readonly subagents: readonly SubagentEntry[]
}

/** One session's token usage, broken down by agent. */
export interface SessionUsage {
  /** The lead session's usage. */
  readonly lead: AgentUsage
  /**
   * Each subagent's usage, or the error that made its transcript
   * unreadable. Isolated per subagent so one unreadable transcript doesn't
   * keep the rest of the session from reporting.
   */
  readonly subagents: ReadonlyMap<AgentId, Result<AgentUsage, UnreadableError>>
}

/**
 * Scans a session's lead transcript and its subagents' transcripts into one
 * token usage report.
 *
 * Every assistant message is credited to whichever agent reports its
 * `message.id` first: the lead is always scanned before its subagents, so
 * a subagent transcript that forked from the lead's context and repeats
 * some of the lead's message ids doesn't double-count them. A subagent's
 * reports are applied to the session's shared ledger only after its whole
 * transcript has been read successfully, so a read that fails partway
 * through never leaves a partial set of messages claimed by that subagent,
 * which would otherwise keep any other agent from claiming them.
 *
 * @param options - The lead transcript's path, its subagents, and read tuning.
 * @returns The lead's usage, and each subagent's usage isolated as a `Result`.
 * @throws {Error} When the lead transcript cannot be read.
 */
export async function scanSessionUsage(options: ScanSessionUsageOptions): Promise<SessionUsage> {
  const { leadPath, subagents, ...readOptions } = options
  const ledger = createUsageLedger()

  const leadReports = await collectAgentReports(readRecords(leadPath, readOptions), leadIdentity)
  for (const report of leadReports.reports) ledger.report(report)

  const subagentReadResults = new Map<AgentId, Result<AgentReports, UnreadableError>>()
  for (const subagent of subagents) {
    const identity = subagentIdentity(subagent.agentId)
    const result = await captureSystemError(() =>
      collectAgentReports(readRecords(subagent.transcript.path, readOptions), identity)
    )
    if (result.ok) {
      for (const report of result.value.reports) ledger.report(report)
    }
    subagentReadResults.set(subagent.agentId, result)
  }

  const entriesByOwner = groupEntriesByOwner(ledger.entries())

  const subagentUsage = new Map<AgentId, Result<AgentUsage, UnreadableError>>()
  for (const [agentId, readResult] of subagentReadResults) {
    if (!readResult.ok) {
      subagentUsage.set(agentId, readResult)
      continue
    }
    const owned = entriesByOwner.get(agentIdentityKey(subagentIdentity(agentId))) ?? []
    subagentUsage.set(agentId, ok(buildAgentUsage(owned, readResult.value.skippedLines)))
  }

  const leadOwned = entriesByOwner.get(agentIdentityKey(leadIdentity)) ?? []
  return {
    lead: buildAgentUsage(leadOwned, leadReports.skippedLines),
    subagents: subagentUsage
  }
}

/**
 * Groups ledger entries by their owning agent.
 * @param entries - Every entry the ledger has seen.
 * @returns A map from each owner's {@link agentIdentityKey} to its entries.
 */
function groupEntriesByOwner(entries: readonly LedgerEntry[]): Map<string, LedgerEntry[]> {
  const byOwner = new Map<string, LedgerEntry[]>()

  for (const entry of entries) {
    const key = agentIdentityKey(entry.owner)
    const group = byOwner.get(key)
    if (group) {
      group.push(entry)
    } else {
      byOwner.set(key, [entry])
    }
  }

  return byOwner
}

/**
 * Builds one agent's usage from the ledger entries it owns.
 * @param owned - The ledger entries this agent owns.
 * @param skippedLines - The count of lines this agent's transcript
 * couldn't contribute as a valid assistant record.
 * @returns The agent's usage.
 */
function buildAgentUsage(owned: readonly LedgerEntry[], skippedLines: number): AgentUsage {
  return {
    tokenGroups: groupTokensByModelAndSpeed(owned),
    messageCount: owned.length,
    skippedLines
  }
}
