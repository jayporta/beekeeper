import { createAgentScanCache } from '../core/session/agentScanCache'
import { createSessionSummaryCache } from '../core/transcript/summary/sessionSummaryCache'
import { createDailyUsageCache } from './overview/dailyUsageCache'
import { hostTimeZone } from './overview/localDayKey'
import { createProjectLabelCache } from './projects/projectLabelCache'
import { createScanScheduler } from './scheduling/scanScheduler'
import { createSessionScanCache } from './sessionDetail/sessionScanCache'
import { createAgentTermsCache } from './sessions/agentTermsCache'
import { createWorkflowRunNamesCache } from './sessions/workflowRunNamesCache'
import type { ServiceDeps } from './serviceDeps'
import { createGitLocator } from './worktrees/gitLocator'

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
 * Builds the services' dependencies for a host's lifetime: one summary cache, one agent scan cache, one agent terms cache, one
 * workflow run names cache, and the schedulers that share and cap summary reads and full scans, a small scan
 * cache, a scheduler for daily usage scans and their cache, the host's time zone, the clock, and a lazy git locator. Worktree diffs are never cached, since a worktree can
 * change while its transcript doesn't.
 *
 * The archive is `null`; a host that keeps one supplies it.
 *
 * @param projectsRoot - The `~/.claude/projects` directory.
 * @returns The dependencies.
 */
export function createServiceDeps(projectsRoot: string): ServiceDeps {
  return {
    projectsRoot,
    projectLabels: createProjectLabelCache(),
    summaryCache: createSessionSummaryCache(),
    agentTerms: createAgentTermsCache(),
    workflowRunNames: createWorkflowRunNamesCache(),
    summaries: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SUMMARIES }),
    scans: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_SCANS }),
    scanCache: createSessionScanCache({ capacity: SCAN_CACHE_CAPACITY }),
    agentScans: createAgentScanCache(),
    dailyUsageScans: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_DAILY_USAGE_SCANS }),
    dailyUsageCache: createDailyUsageCache(),
    timeZone: hostTimeZone,
    diffs: createScanScheduler({ maxConcurrent: MAX_CONCURRENT_DIFFS }),
    now: Date.now,
    git: createGitLocator(),
    archive: null
  }
}
