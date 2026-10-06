import type { SessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import type { GitLocation } from '../git/gitLocator'
import type { AgentTermsCache } from './agentTermsCache'
import type { ProjectLabelCache } from './projectLabelCache'
import type { LaneScanScheduler, ScanScheduler } from './scanScheduler'
import type { SessionScanCache } from './sessionScanCache'

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
  /**
   * Shares and caps the summary reads behind a session listing, one per
   * transcript, and the agent term reads that follow them. Bulk reads nobody
   * waits on, such as project totals, take its background lane.
   */
  readonly summaries: LaneScanScheduler
  /** Shares and caps full session scans. */
  readonly scans: ScanScheduler
  /** Recent completed session scans, shared by every handler that scans. */
  readonly scanCache: SessionScanCache
  /** Shares in-flight worktree diffs and caps how many run at once. Results are never cached. */
  readonly diffs: ScanScheduler
  /** The current time in epoch milliseconds. Injectable so tests can stop the clock. */
  readonly now: () => number
  /** Locates git, lazily. Injectable so tests can fake a missing git. */
  readonly git: () => Promise<GitLocation>
}
