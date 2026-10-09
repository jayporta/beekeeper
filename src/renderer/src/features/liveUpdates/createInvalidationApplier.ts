import type { Query, QueryClient } from '@tanstack/react-query'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { allowsBackgroundRefetch } from '@renderer/app/backgroundRefetchRules'
import { TOTALS_ROOTS } from '@renderer/app/totalsRoots'
import { createDetailThrottle, type DetailThrottle, type ThrottleTimers } from './detailThrottle'
import { familyOf, isInFamilies, type Families, type InvalidationPlan } from './invalidationPlan'

/** A fetch already running is left to finish, since a large scan can outlast the update interval. */
const KEEP_RUNNING = { cancelRefetch: false } as const

/** How a query group is invalidated: totals are only marked stale, the rest refetch if on screen. */
interface Rule {
  /** Whether the rule covers a query. */
  readonly matches: (query: Query) => boolean
  /** `none` to mark stale without refetching. */
  readonly refetchType?: 'none'
}

const DEFAULT_TIMERS: ThrottleTimers = {
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
}

/** Applies invalidation plans to one query client. */
export interface InvalidationApplier {
  /**
   * Applies a plan: the project list, the session lists and the totals now,
   * the session details at the end of the detail throttle interval.
   * @param plan - What to refresh, from `invalidationPlan`.
   */
  apply(plan: InvalidationPlan): void
  /** Refreshes everything now, details included, as when live updates resume. */
  applyAll(): void
  /** Drops the session details waiting for the throttle, and the follow-ups owed to fetches in flight. */
  cancelPending(): void
  /** Drops the waiting details and stops following fetches. Call it when done. */
  dispose(): void
}

const EVERYTHING: InvalidationPlan = { projects: true, families: 'all', staleTotals: 'all' }

/**
 * Creates the applier of invalidation plans for a query client. It
 * invalidates the project list and the session lists and details of the
 * planned families, so the ones on screen refetch and the rest refetch when
 * next shown. A query whose failure the page shows as an error screen is
 * skipped (see {@link allowsBackgroundRefetch}). Totals and daily usage of the
 * planned folders are only marked stale, since each reads a whole folder.
 * Worktree diffs and patches are left alone.
 *
 * A session detail scan is slow, so details refresh at most once per
 * `DETAIL_LIVE_INTERVAL_MS`, with the families merged. A query that was
 * fetching when a plan covered it would otherwise lose the change, since its
 * fetch finishing marks it fresh: the applier remembers it, and invalidates
 * it once more when that fetch settles.
 *
 * @param client - The app's query client.
 * @param timers - The timer functions for the detail throttle. They default to `setTimeout` and `clearTimeout`.
 * @returns The applier.
 */
export function createInvalidationApplier(
  client: QueryClient,
  timers: ThrottleTimers = DEFAULT_TIMERS
): InvalidationApplier {
  // The queries a plan covered mid-fetch, whose follow-up is still owed. A WeakSet can't be
  // cleared, so it is replaced.
  let watched = new WeakSet<Query>()

  function invalidate(rule: Rule): void {
    for (const query of client.getQueryCache().findAll({ predicate: rule.matches })) {
      if (query.state.fetchStatus === 'fetching') watched.add(query)
    }
    void client.invalidateQueries(
      { predicate: rule.matches, refetchType: rule.refetchType },
      KEEP_RUNNING
    )
  }

  function invalidateDetails(families: Families): void {
    const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
    invalidate({
      matches: (query) =>
        query.queryKey[0] === 'session' &&
        isInFamilies(families, projects, query.queryKey) &&
        allowsBackgroundRefetch(query)
    })
  }

  const details: DetailThrottle = createDetailThrottle({
    onFlush: invalidateDetails,
    ...timers
  })

  // A fetch that was running when a plan covered its query ends: cover the query again. A
  // session detail goes back through the throttle, so its follow-up waits for the next flush.
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return
    if (event.action.type !== 'success' && event.action.type !== 'error') return
    if (!watched.delete(event.query)) return
    const { queryKey } = event.query
    if (queryKey[0] === 'session' && typeof queryKey[1] === 'string') {
      const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
      details.add(new Set([familyOf(queryKey[1], projects)]))
      return
    }
    void client.invalidateQueries(
      {
        queryKey,
        predicate: allowsBackgroundRefetch,
        refetchType: TOTALS_ROOTS.includes(queryKey[0]) ? 'none' : undefined
      },
      KEEP_RUNNING
    )
  })

  function applyNow(plan: InvalidationPlan): void {
    const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
    const hasStaleTotals = ({ queryKey }: Query): boolean =>
      plan.staleTotals === 'all' ||
      (typeof queryKey[1] === 'string' && plan.staleTotals.has(queryKey[1]))

    if (plan.projects) {
      invalidate({
        matches: (query) => query.queryKey[0] === 'projects' && allowsBackgroundRefetch(query)
      })
    }
    invalidate({
      matches: (query) =>
        query.queryKey[0] === 'sessions' &&
        isInFamilies(plan.families, projects, query.queryKey) &&
        allowsBackgroundRefetch(query)
    })
    invalidate({
      matches: (query) => TOTALS_ROOTS.includes(query.queryKey[0]) && hasStaleTotals(query),
      refetchType: 'none'
    })
  }

  return {
    apply(plan) {
      applyNow(plan)
      details.add(plan.families)
    },
    applyAll() {
      applyNow(EVERYTHING)
      details.add('all')
      details.flush()
    },
    cancelPending() {
      details.cancel()
      watched = new WeakSet()
    },
    dispose() {
      details.cancel()
      unsubscribe()
    }
  }
}
