import { join } from 'node:path'
import { createSessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import { createGitLocator } from '../git/gitLocator'
import type { IpcDeps } from './ipcDeps'
import { createScanScheduler } from './scanScheduler'
import { createSessionScanCache } from './sessionScanCache'

/** How many transcript summary reads may run at once. */
export const MAX_CONCURRENT_SUMMARIES = 3

/** How many full session scans may run at once. */
export const MAX_CONCURRENT_SCANS = 2

/** How many worktree diffs may run at once. */
export const MAX_CONCURRENT_DIFFS = 3

/** How many completed session scans the cache keeps. */
export const SCAN_CACHE_CAPACITY = 4

/**
 * Builds the handlers' dependencies for the app's lifetime: the projects
 * root under the user's home, one summary cache, and the schedulers that share and cap summary reads
 * and full scans, a small scan cache, and a lazy git locator.
 * Worktree diffs are never cached, since a worktree can change while its
 * transcript doesn't.
 * @param homeDir - The user's home directory.
 * @returns The dependencies.
 */
export function createIpcDeps(homeDir: string): IpcDeps {
  return {
    projectsRoot: join(homeDir, '.claude', 'projects'),
    summaryCache: createSessionSummaryCache(),
    summaries: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SUMMARIES }),
    scans: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SCANS }),
    scanCache: createSessionScanCache({ capacity: SCAN_CACHE_CAPACITY }),
    diffs: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_DIFFS }),
    git: createGitLocator()
  }
}
