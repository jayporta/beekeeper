import type { LineScan } from '../transcript/feedLineScan'
import type { CostStateRecord } from '../transcript/schemas'
import type { AgentIdentity } from './agentIdentity'
import { createAgentReportsFold, type AgentReports } from './agentReportsFold'
import { createRecordedCostState } from './recordedCostState'
import { createSpawnObserver, type TranscriptSpawns } from './spawnObserver'

/** The weight, in UTF-16 code units, an agent scan carries before any line: its observers and their bookkeeping. */
export const AGENT_SCAN_BASE_WEIGHT = 256

/** What one transcript showed, as of a moment: nothing in it changes when more lines are observed. */
export interface AgentScanSnapshot {
  /** The agent's message reports, file touches, signal events and skipped-line count. */
  readonly reports: AgentReports
  /** The `Agent` calls, branch timeline, start and first cwd the transcript showed. */
  readonly spawns: TranscriptSpawns
  /** The transcript's last valid `cost-state`, reduced, or `null` when it has none or the scan doesn't track one. */
  readonly costState: CostStateRecord | null
}

/** Options for {@link createAgentScan}. */
export interface AgentScanOptions {
  /** The agent whose transcript is scanned. */
  readonly identity: AgentIdentity
  /** Whether to track the transcript's `cost-state`, which only the lead's is read for. */
  readonly trackCostState: boolean
}

/** One agent's transcript folded line by line, and readable at any point. */
export interface AgentScan extends LineScan {
  /**
   * What the lines observed so far showed. Reading it leaves the scan as it
   * was, so more lines can follow, and the result shares no list or map with
   * the scan, so later lines never change a snapshot already returned. The
   * scan keeps the snapshot until the next line is observed and returns that
   * same object again, so a transcript that has not grown costs nothing to
   * read. The kept snapshot's lists hold a pointer per entry, which the
   * per-entry weights allow for.
   */
  snapshot(): AgentScanSnapshot
}

/**
 * Creates the fold behind a session's detail scan for one transcript: its
 * reports, its spawns and branch timeline, and optionally its last
 * `cost-state`, all read in one pass over its lines. Feeding it a file's lines
 * in order gives what a scan of the whole file shows, and feeding it the lines
 * after those it has already seen gives what a scan of the longer file from
 * the start shows, which lets a cache keep it and read only what a growing
 * transcript gained.
 *
 * @param options - The agent, and whether to track its cost state.
 * @returns A scan with nothing observed.
 */
export function createAgentScan(options: AgentScanOptions): AgentScan {
  const reports = createAgentReportsFold(options.identity)
  const spawns = createSpawnObserver()
  const costState = options.trackCostState ? createRecordedCostState() : null
  let kept: AgentScanSnapshot | undefined

  return {
    observe(input) {
      kept = undefined
      reports.observe(input)
      if (!input.ok) return
      spawns.observe(input.value)
      costState?.observe(input.value)
    },
    snapshot() {
      const live = spawns.result()
      kept ??= {
        reports: reports.snapshot(),
        spawns: { ...live, spawns: new Map(live.spawns), timeline: [...live.timeline] },
        costState: costState?.latest() ?? null
      }
      return kept
    },
    weight: () =>
      AGENT_SCAN_BASE_WEIGHT + reports.weight() + spawns.weight() + (costState?.weight() ?? 0)
  }
}
