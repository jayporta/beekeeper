import type { Query, QueryClient } from '@tanstack/react-query'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { allowsBackgroundRefetch } from '@renderer/app/backgroundRefetchRules'
import { familyOf, type InvalidationPlan } from './invalidationPlan'

/** A fetch already running is left to finish, since a large scan can outlast the update interval. */
const KEEP_RUNNING = { cancelRefetch: false } as const

const SESSION_ROOTS: readonly unknown[] = ['sessions', 'session']
const TOTALS_ROOTS: readonly unknown[] = ['projectTotals', 'projectDailyUsage']

/**
 * Applies a plan to the query cache. The project list and the session lists
 * and details of the planned families are invalidated, so the ones on screen
 * refetch and the rest refetch when next shown. A query whose failure the
 * page shows as an error screen is skipped (see {@link allowsBackgroundRefetch}).
 * Totals and daily usage of the planned folders are only marked stale, since
 * each reads a whole folder. Worktree diffs and patches are left alone.
 *
 * @param client - The app's query client.
 * @param plan - What to refresh, from `invalidationPlan`.
 */
export function applyInvalidationPlan(client: QueryClient, plan: InvalidationPlan): void {
  const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
  const inFamilies = ({ queryKey }: Query): boolean =>
    plan.families === 'all' ||
    (typeof queryKey[1] === 'string' && plan.families.has(familyOf(queryKey[1], projects)))
  const hasStaleTotals = ({ queryKey }: Query): boolean =>
    plan.staleTotals === 'all' ||
    (typeof queryKey[1] === 'string' && plan.staleTotals.has(queryKey[1]))

  if (plan.projects) {
    void client.invalidateQueries(
      { queryKey: ['projects'], predicate: allowsBackgroundRefetch },
      KEEP_RUNNING
    )
  }
  void client.invalidateQueries(
    {
      predicate: (query) =>
        SESSION_ROOTS.includes(query.queryKey[0]) &&
        inFamilies(query) &&
        allowsBackgroundRefetch(query)
    },
    KEEP_RUNNING
  )
  void client.invalidateQueries({
    predicate: (query) => TOTALS_ROOTS.includes(query.queryKey[0]) && hasStaleTotals(query),
    refetchType: 'none'
  })
}
