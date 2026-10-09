import type { SessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import type { GitLocation } from '../git/gitLocator'
import type { OtelRuntime } from '../otel/createOtelRuntime'
import type { DailyUsageCache } from '../overview/dailyUsageCache'
import type { AgentTermsCache } from './agentTermsCache'
import type { ProjectLabelCache } from './projectLabelCache'
import type { LaneScanScheduler, ScanScheduler } from './scanScheduler'
import type { SessionScanCache } from './sessionScanCache'
import type { WorkflowRunNamesCache } from './workflowRunNamesCache'

/** What the handlers need, injected so tests can point them at a temp directory. */
export interface IpcDeps {
  /** The `~/.claude/projects` directory. */
  readonly projectsRoot: string
  /** Project labels read from one of each project's first few transcripts, kept for the app's lifetime. */
  readonly projectLabels: ProjectLabelCache
  /** Summaries of scanned transcripts, kept for the app's lifetime. */
  readonly summaryCache: SessionSummaryCache
  /** Search terms of each session's subagents, read from their meta files and kept for the app's lifetime. */
  readonly agentTerms: AgentTermsCache
  /** Names of each session's workflow runs, read from their records and kept for the app's lifetime. */
  readonly workflowRunNames: WorkflowRunNamesCache
  /**
   * Shares and caps the summary reads behind a session listing, one per
   * transcript, and the agent term and workflow run name reads that follow
   * them. Bulk reads nobody waits on, such as project totals and the leads
   * behind the tokens-per-day chart, take its background lane.
   */
  readonly summaries: LaneScanScheduler
  /** Shares and caps full session scans. */
  readonly scans: ScanScheduler
  /** Recent completed session scans, shared by every handler that scans. */
  readonly scanCache: SessionScanCache
  /**
   * Shares and caps the daily usage scans, one per session: a session with
   * subagents reads its lead summary (through `summaries`, in its background
   * lane) and its subagents in one slot here, and a lead too long for its
   * summary to hold is read in full here. A session with no subagents whose
   * lead fits in its summary never queues here.
   */
  readonly dailyUsageScans: ScanScheduler
  /** Complete per-session daily usage, shared by every folder's daily usage read. */
  readonly dailyUsageCache: DailyUsageCache
  /**
   * The IANA time zone that decides where a day begins, read on each daily
   * usage call so a changed system zone is followed. Injectable so tests can
   * fix the zone.
   */
  readonly timeZone: () => string
  /** Shares in-flight worktree diffs and caps how many run at once. Results are never cached. */
  readonly diffs: ScanScheduler
  /** The current time in epoch milliseconds. Injectable so tests can stop the clock. */
  readonly now: () => number
  /** Locates git, lazily. Injectable so tests can fake a missing git. */
  readonly git: () => Promise<GitLocation>
  /**
   * The opt-in telemetry receiver and what it has heard, or `null` when the
   * app didn't set one up. The app sets it in `index.ts`, so tests that don't
   * touch it get `null`.
   */
  readonly otel: OtelRuntime | null
}
