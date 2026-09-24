import { join } from 'node:path'
import { createSessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import type { IpcDeps } from './ipcDeps'
import { createScanScheduler } from './scanScheduler'

/** How many transcript summary reads may run at once. */
export const MAX_CONCURRENT_SUMMARIES = 3

/** How many full session scans may run at once. */
export const MAX_CONCURRENT_SCANS = 2

/**
 * Builds the handlers' dependencies for the app's lifetime: the projects
 * root under the user's home, one summary cache, and the schedulers that share and cap summary reads
 * and full scans.
 * @param homeDir - The user's home directory.
 * @returns The dependencies.
 */
export function createIpcDeps(homeDir: string): IpcDeps {
  return {
    projectsRoot: join(homeDir, '.claude', 'projects'),
    summaryCache: createSessionSummaryCache(),
    summaries: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SUMMARIES }),
    scans: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SCANS })
  }
}
