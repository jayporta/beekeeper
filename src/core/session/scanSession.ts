import { ok, type Result } from '../shared/result'
import { captureSystemError } from '../transcript/captureSystemError'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import type { AgentId } from '../transcript/ids'
import type { ScanReadTuning } from '../transcript/resumableScan'
import { statTranscriptFile } from '../transcript/statTranscriptFile'
import type { UnreadableError } from '../transcript/unreadableError'
import { resolveAgentHierarchy } from './agentHierarchy'
import { agentIdentityKey, leadIdentity, subagentIdentity } from './agentIdentity'
import { applyAgentReports, buildAgentReport, type AgentReport } from './agentReports'
import { buildAgentTree, type AgentTreeInput, type AgentTreeNode } from './agentTree'
import { createAgentScanCache, type AgentScanCache } from './agentScanCache'
import { createFilesLedger } from './filesLedger'
import { groupByOwner } from './groupByOwner'
import { reconcileUsage, type UsageReconciliation } from './reconcileUsage'
import { resolveSpawnContexts } from './resolveSpawnContexts'
import { resolveSubagentMeta } from './resolveSubagentMeta'
import { createSignalsLedger } from './signalsLedger'
import type { SpawnContext } from './spawnContext'
import type { TranscriptSpawns } from './spawnObserver'
import { createUsageLedger } from './usageLedger'

/** Options for {@link scanSession}. */
export interface ScanSessionOptions extends ScanReadTuning {
  /** Absolute path to the session's lead transcript. */
  readonly leadPath: string
  /** The session's subagent transcripts, scanned after the lead, in order. */
  readonly subagents: readonly SubagentEntry[]
  /**
   * Whether the session's `subagents/` folder couldn't be listed, so
   * `subagents` is empty for lack of information rather than lack of agents.
   * Counts as one unreadable agent in the reconciliation.
   * @defaultValue `false`
   */
  readonly subagentsUnreadable?: boolean
  /**
   * Keeps the scan of each transcript between calls, so a transcript that
   * grew since the last call is read from where that scan stopped instead of
   * from its first byte. The scan equals what reading everything again gives.
   * @defaultValue a cache that keeps nothing, so every transcript is read in full
   */
  readonly cache?: AgentScanCache
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
  /**
   * Where each subagent was spawned from, for the subagents that resolved a
   * context. Read from every transcript, since a subagent can spawn others.
   */
  readonly spawnContexts: ReadonlyMap<AgentId, SpawnContext>
  /**
   * The `cwd` of the lead transcript's first record with a valid one, meaning
   * an absolute path within the observer's cap, or `undefined` when none had
   * one.
   */
  readonly leadFirstCwd: string | undefined
}

/**
 * Scans a session's lead transcript and its subagents' transcripts into one
 * report: an agent tree, and each agent's token usage, file touches and signals.
 *
 * Every assistant message, file touch and signal event is credited to
 * whichever agent reports it first: the lead is always scanned before its
 * subagents, so a subagent transcript that forked from the lead's context and
 * repeats some of the lead's message ids or tool use ids doesn't double-count
 * them. A subagent's reports are applied to the session's shared ledgers
 * only after its whole transcript has been read successfully, so a read that
 * fails partway through never leaves a partial set of messages, touches or
 * signal events claimed by that subagent.
 *
 * Each transcript is read into a scan of its own, and the ledgers are built
 * from those scans in order, the lead first and then the subagents as given.
 * With a `cache`, a transcript's scan outlives the call and a growing
 * transcript is read only from where it stopped. The ledgers are rebuilt on
 * every call rather than kept, so crediting follows the order the transcripts
 * are listed in now, not the order they were last read in. Each subagent's `.meta.json` is read
 * separately from its transcript into a meta status; a missing or
 * unreadable meta never fails the scan, it just leaves that subagent
 * parented to the lead in the tree, with its status recorded for display
 * rather than silently discarded.
 *
 * @param options - The lead transcript's path, its subagents, whether the
 * subagents folder was unreadable, a cache of transcript scans, and read
 * tuning.
 * @returns The session's agent tree, the lead's report, each subagent's
 * report isolated as a `Result`, and the usage reconciliation. Only the
 * lead is read for a `cost-state`, in the same pass as its usage. When
 * `subagentsUnreadable` is set, the totals are flagged partial.
 * @throws {Error} When the lead transcript cannot be read, carrying the
 * system error code.
 */
export async function scanSession(options: ScanSessionOptions): Promise<SessionScan> {
  const {
    leadPath,
    subagents,
    subagentsUnreadable = false,
    cache = createAgentScanCache({ maxWeight: 0 }),
    highWaterMark,
    maxLineChars
  } = options
  const tuning: ScanReadTuning = { highWaterMark, maxLineChars }
  const usageLedger = createUsageLedger()
  const filesLedger = createFilesLedger()
  const signalsLedger = createSignalsLedger()

  const leadFile = await statTranscriptFile(leadPath)
  if (leadFile === null) {
    throw Object.assign(new Error('The lead transcript is not a regular file'), { code: 'ENOENT' })
  }
  const leadScan = await cache.read({
    file: leadFile,
    identity: leadIdentity,
    trackCostState: true,
    tuning
  })
  applyAgentReports({
    usageLedger,
    filesLedger,
    signalsLedger,
    identity: leadIdentity,
    agentReports: leadScan.reports
  })

  // Once a subagent's reports are in the ledgers, only its skipped-line count is
  // needed, so the reports (touches, message reports) are not kept until the scan ends.
  const subagentSpawns = new Map<AgentId, TranscriptSpawns>()
  const subagentSkippedLines = new Map<AgentId, Result<number, UnreadableError>>()
  const treeInputs: AgentTreeInput[] = []

  for (const subagent of subagents) {
    const identity = subagentIdentity(subagent.agentId)
    const read = await captureSystemError(() =>
      cache.read({ file: subagent.transcript, identity, trackCostState: false, tuning })
    )
    if (read.ok) {
      applyAgentReports({
        usageLedger,
        filesLedger,
        signalsLedger,
        identity,
        agentReports: read.value.reports
      })
      subagentSpawns.set(subagent.agentId, read.value.spawns)
    }
    subagentSkippedLines.set(subagent.agentId, read.ok ? ok(read.value.reports.skippedLines) : read)

    const metaStatus = await resolveSubagentMeta(subagent.metaPath)
    treeInputs.push({
      agentId: subagent.agentId,
      metaStatus,
      workflowRunId: subagent.workflowRunId
    })
  }

  const usageByOwner = groupByOwner(usageLedger.entries())
  const touchesByOwner = groupByOwner(filesLedger.entries())
  const incompleteOwners = new Set(filesLedger.incompleteOwners().map(agentIdentityKey))
  const signalsByOwner = groupByOwner(signalsLedger.entries())
  const signalsCappedOwners = signalsLedger.cappedOwners()

  const subagentReports = new Map<AgentId, Result<AgentReport, UnreadableError>>()
  for (const [agentId, skipped] of subagentSkippedLines) {
    if (!skipped.ok) {
      subagentReports.set(agentId, skipped)
      continue
    }
    const identity = subagentIdentity(agentId)
    const report = buildAgentReport({
      identity,
      usageByOwner,
      touchesByOwner,
      incompleteOwners,
      signalsByOwner,
      signalsCappedOwners,
      skippedLines: skipped.value
    })
    subagentReports.set(agentId, ok(report))
  }

  const lead = buildAgentReport({
    identity: leadIdentity,
    usageByOwner,
    touchesByOwner,
    incompleteOwners,
    signalsByOwner,
    signalsCappedOwners,
    skippedLines: leadScan.reports.skippedLines
  })

  const readableAgents = [
    lead,
    ...[...subagentReports.values()].flatMap((r) => (r.ok ? [r.value] : []))
  ]
  const unreadableSubagents = [...subagentReports.values()].filter((r) => !r.ok).length

  const hierarchy = resolveAgentHierarchy(treeInputs)

  return {
    tree: buildAgentTree(hierarchy),
    lead,
    subagents: subagentReports,
    reconciliation: reconcileUsage({
      agents: readableAgents.map((agent) => agent.usage),
      unreadableAgents: unreadableSubagents + (subagentsUnreadable ? 1 : 0),
      costState: leadScan.costState
    }),
    leadFirstCwd: leadScan.spawns.firstCwd,
    spawnContexts: resolveSpawnContexts({
      hierarchy,
      leadTranscript: leadScan.spawns,
      subagentTranscripts: subagentSpawns
    })
  }
}
