import { join } from 'node:path'
import { createSessionSummaryCache } from '../../core/transcript/summary/sessionSummaryCache'
import { createGitLocator } from '../git/gitLocator'
import { createDailyUsageCache } from '../overview/dailyUsageCache'
import { hostTimeZone } from '../overview/localDayKey'
import { createAgentTermsCache } from './agentTermsCache'
import type { IpcDeps } from './ipcDeps'
import { createProjectLabelCache } from './projectLabelCache'
import { createScanScheduler } from './scanScheduler'
import { createSessionScanCache } from './sessionScanCache'
import { createWorkflowRunNamesCache } from './workflowRunNamesCache'

/** How many transcript summary reads may run at once. */
export const MAX_CONCURRENT_SUMMARIES = 3

/** How many full session scans may run at once. */
export const MAX_CONCURRENT_SCANS = 2

/** How many session daily usage scans may run at once. */
export const MAX_CONCURRENT_DAILY_USAGE_SCANS = 1

/** How many worktree diffs may run at once. */
export const MAX_CONCURRENT_DIFFS = 3

/** How many completed session scans the cache keeps. */
export const SCAN_CACHE_CAPACITY = 4

/**
 * Builds the handlers' dependencies for the app's lifetime: the projects
 * root under the user's home, one summary cache, one agent terms cache, one
 * workflow run names cache, and the schedulers that share and cap summary reads and full scans, a small scan
 * cache, a scheduler for daily usage scans and their cache, the host's time zone, the clock, and a lazy git locator. Worktree diffs are never cached, since a worktree can
 * change while its transcript doesn't.
 *
 * The telemetry receiver and the clipboard writer are `null`; the app supplies them.
 *
 * @param homeDir - The user's home directory.
 * @returns The dependencies.
 */
export function createIpcDeps(homeDir: string): IpcDeps {
  return {
    projectsRoot: join(homeDir, '.claude', 'projects'),
    projectLabels: createProjectLabelCache(),
    summaryCache: createSessionSummaryCache(),
    agentTerms: createAgentTermsCache(),
    workflowRunNames: createWorkflowRunNamesCache(),
    summaries: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SUMMARIES }),
    scans: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SCANS }),
    scanCache: createSessionScanCache({ capacity: SCAN_CACHE_CAPACITY }),
    dailyUsageScans: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_DAILY_USAGE_SCANS }),
    dailyUsageCache: createDailyUsageCache(),
    timeZone: hostTimeZone,
    diffs: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_DIFFS }),
    now: Date.now,
    git: createGitLocator(),
    otel: null,
    copyToClipboard: null
  }
}
