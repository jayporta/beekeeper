import type { SubagentEntry } from '../transcript/discoverSubagents'
import { createLastCostState } from '../transcript/lastCostState'
import type { AgentId } from '../transcript/ids'
import type { ReadJsonlLinesOptions } from '../transcript/readJsonlLines'
import { readRecords } from '../transcript/readRecords'
import { ok, type Result } from '../transcript/result'
import type { UnreadableError } from '../transcript/unreadableError'
import {
  agentIdentityKey,
  leadIdentity,
  subagentIdentity,
  type AgentIdentity
} from './agentIdentity'
import { buildAgentTree, type AgentTreeInput, type AgentTreeNode } from './agentTree'
import type { AgentUsage } from './agentUsage'
import { collectAgentReports, type AgentReports } from './collectAgentReports'
import type { FileTouch } from './fileTouchCollector'
import { createFilesLedger, type FileTouchEntry, type FilesLedger } from './filesLedger'
import { groupByOwner } from './groupByOwner'
import { reconcileUsage, type UsageReconciliation } from './reconcileUsage'
import { readSubagentTranscript } from './readSubagentTranscript'
import { resolveSubagentMeta } from './resolveSubagentMeta'
import { tapRecords } from './tapRecords'
import { groupTokensByModelAndSpeed } from './tokenGroup'
import { createUsageLedger, type LedgerEntry, type UsageLedger } from './usageLedger'

/** Options for {@link scanSession}. */
export interface ScanSessionOptions extends ReadJsonlLinesOptions {
  /** Absolute path to the session's lead transcript. */
  readonly leadPath: string
  /** The session's subagent transcripts, scanned after the lead, in order. */
  readonly subagents: readonly SubagentEntry[]
}

/** One agent's usage and file touches, scanned from its transcript. */
export interface AgentReport {
  /** The agent's token usage. */
  readonly usage: AgentUsage
  /** The files the agent's `Edit`/`Write` tool calls touched. */
  readonly fileTouches: readonly FileTouch[]
}

/** A session's agent tree, alongside each agent's usage and file touches. */
export interface SessionScan {
  /** The session's agent tree, rooted at the lead. */
  readonly tree: AgentTreeNode
  /** The lead session's report. */
  readonly lead: AgentReport
  /**
   * Each subagent's report, or the error that made its transcript
   * unreadable. Isolated per subagent so one unreadable transcript doesn't
   * keep the rest of the session from reporting.
   */
  readonly subagents: ReadonlyMap<AgentId, Result<AgentReport, UnreadableError>>
  /**
   * The transcripts' usage beside the lead's recorded `cost-state`. Covers
   * the lead and every readable subagent.
   */
  readonly reconciliation: UsageReconciliation
}

/**
 * Scans a session's lead transcript and its subagents' transcripts into one
 * report: an agent tree, and each agent's token usage and file touches.
 *
 * Every assistant message and file touch is credited to whichever agent
 * reports it first: the lead is always scanned before its subagents, so a
 * subagent transcript that forked from the lead's context and repeats some
 * of the lead's message ids or tool use ids doesn't double-count them. A
 * subagent's reports are applied to the session's shared ledgers only
 * after its whole transcript has been read successfully, so a read that
 * fails partway through never leaves a partial set of messages or touches
 * claimed by that subagent. Each subagent's `.meta.json` is read
 * separately from its transcript into a meta status; a missing or
 * unreadable meta never fails the scan, it just leaves that subagent
 * parented to the lead in the tree, with its status recorded for display
 * rather than silently discarded.
 *
 * @param options - The lead transcript's path, its subagents, and read tuning.
 * @returns The session's agent tree, the lead's report, each subagent's
 * report isolated as a `Result`, and the usage reconciliation. Only the
 * lead is read for a `cost-state`, in the same pass as its usage.
 * @throws {Error} When the lead transcript cannot be read.
 */
export async function scanSession(options: ScanSessionOptions): Promise<SessionScan> {
  const { leadPath, subagents, ...readOptions } = options
  const usageLedger = createUsageLedger()
  const filesLedger = createFilesLedger()

  const lastCostState = createLastCostState()
  const leadReports = await collectAgentReports(
    tapRecords(readRecords(leadPath, readOptions), lastCostState.observe),
    leadIdentity
  )
  applyAgentReports({ usageLedger, filesLedger, identity: leadIdentity, agentReports: leadReports })

  const subagentReadResults = new Map<AgentId, Result<AgentReports, UnreadableError>>()
  const treeInputs: AgentTreeInput[] = []

  for (const subagent of subagents) {
    const identity = subagentIdentity(subagent.agentId)
    const readResult = await readSubagentTranscript({ subagent, readOptions })
    if (readResult.ok) {
      applyAgentReports({ usageLedger, filesLedger, identity, agentReports: readResult.value })
    }
    subagentReadResults.set(subagent.agentId, readResult)

    const metaStatus = await resolveSubagentMeta(subagent.metaPath)
    treeInputs.push({ agentId: subagent.agentId, metaStatus })
  }

  const usageByOwner = groupByOwner(usageLedger.entries())
  const touchesByOwner = groupByOwner(filesLedger.entries())

  const subagentReports = new Map<AgentId, Result<AgentReport, UnreadableError>>()
  for (const [agentId, readResult] of subagentReadResults) {
    if (!readResult.ok) {
      subagentReports.set(agentId, readResult)
      continue
    }
    const identity = subagentIdentity(agentId)
    const report = buildAgentReport({
      identity,
      usageByOwner,
      touchesByOwner,
      skippedLines: readResult.value.skippedLines
    })
    subagentReports.set(agentId, ok(report))
  }

  const lead = buildAgentReport({
    identity: leadIdentity,
    usageByOwner,
    touchesByOwner,
    skippedLines: leadReports.skippedLines
  })

  const readableAgents = [
    lead,
    ...[...subagentReports.values()].flatMap((r) => (r.ok ? [r.value] : []))
  ]

  return {
    tree: buildAgentTree(treeInputs),
    lead,
    subagents: subagentReports,
    reconciliation: reconcileUsage({
      agents: readableAgents.map((agent) => agent.usage),
      unreadableAgents: subagentReports.size + 1 - readableAgents.length,
      costState: lastCostState.latest()
    })
  }
}

/** Input for {@link applyAgentReports}. */
interface ApplyAgentReportsInput {
  readonly usageLedger: UsageLedger
  readonly filesLedger: FilesLedger
  readonly identity: AgentIdentity
  readonly agentReports: AgentReports
}

/** Applies one agent's already-read reports to the session's shared ledgers. */
function applyAgentReports(input: ApplyAgentReportsInput): void {
  const { usageLedger, filesLedger, identity, agentReports } = input
  for (const report of agentReports.reports) usageLedger.report(report)
  for (const touch of agentReports.fileTouches) filesLedger.report({ identity, touch })
}

/** Input for {@link buildAgentReport}. */
interface BuildAgentReportInput {
  readonly identity: AgentIdentity
  readonly usageByOwner: ReadonlyMap<string, readonly LedgerEntry[]>
  readonly touchesByOwner: ReadonlyMap<string, readonly FileTouchEntry[]>
  readonly skippedLines: number
}

/**
 * Builds one agent's report from the ledger entries it owns.
 * @param input - The agent's identity, the grouped ledgers, and its
 * transcript's skipped-line count.
 * @returns The agent's usage and file touches.
 */
function buildAgentReport(input: BuildAgentReportInput): AgentReport {
  const { identity, usageByOwner, touchesByOwner, skippedLines } = input
  const key = agentIdentityKey(identity)
  const owned = usageByOwner.get(key) ?? []

  const ownedTouches = touchesByOwner.get(key) ?? []

  return {
    usage: {
      tokenGroups: groupTokensByModelAndSpeed(owned),
      messageCount: owned.length,
      skippedLines
    },
    fileTouches: ownedTouches.map((entry) => entry.touch)
  }
}
