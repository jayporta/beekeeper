import type { SessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import type { ScanScheduler } from './scanScheduler'

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
}
