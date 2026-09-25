import type { SessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import type { GitLocation } from '../git/gitLocator'
import type { ScanScheduler } from './scanScheduler'
import type { SessionScanCache } from './sessionScanCache'

/** What the handlers need, injected so tests can point them at a temp directory. */
export interface IpcDeps {
  /** The `~/.claude/projects` directory. */
  readonly projectsRoot: string
  /** Summaries of scanned transcripts, kept for the app's lifetime. */
  readonly summaryCache: SessionSummaryCache
  /** Shares and caps the summary reads behind a session listing, one per transcript. */
  readonly summaries: ScanScheduler
  /** Shares and caps full session scans. */
  readonly scans: ScanScheduler
  /** Recent completed session scans, shared by every handler that scans. */
  readonly scanCache: SessionScanCache
  /** Shares in-flight worktree diffs and caps how many run at once. Results are never cached. */
  readonly diffs: ScanScheduler
  /** Locates git, lazily. Injectable so tests can fake a missing git. */
  readonly git: () => Promise<GitLocation>
}
