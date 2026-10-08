import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ProjectDailyUsageDto } from '../../../../../shared/ipc/projectDailyUsageDto'
import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { useProjects } from '@renderer/features/projects/useProjects'
import { useTotalsWindowStore } from '../state/useTotalsWindowStore'
import { dailyUsageLimiterFor } from './dailyUsageLimiter'
import { createDailyUsagePlaceholder, placeholderRange } from './dailyUsagePlaceholder'
import { pruneStaleDailyUsage } from './pruneStaleDailyUsage'
import { useTodayKey } from './useTodayKey'
import { sumDailyUsage, type DailyUsageSummary, type FolderDailyUsageState } from './sumDailyUsage'

const DAY_COUNT: Readonly<Record<TotalsWindowDto, number>> = { '7d': 7, '30d': 30 }

function stateOf(
  result: UseQueryResult<ProjectDailyUsageDto>,
  range: TotalsWindowDto
): FolderDailyUsageState {
  // Data wins over a failed background refresh, so figures on screen stay on screen.
  if (result.data !== undefined) {
    return {
      status: 'ready',
      usage: result.data,
      refreshing: result.isPlaceholderData,
      otherWindow: result.isPlaceholderData && placeholderRange(result.data) !== range
    }
  }
  return result.isError ? { status: 'error' } : { status: 'loading' }
}

/** What {@link useDailyUsage} returns. */
export interface DailyUsage {
  /** The window the usage covers. */
  readonly window: TotalsWindowDto
  /** Every listed folder's usage, added together. */
  readonly summary: DailyUsageSummary
}

/**
 * Loads every listed folder's tokens by day and model for the chosen window,
 * and adds them together: one query per folder.
 *
 * @remarks
 * The query key holds today's local day, so a new day asks again and a
 * persisted result from another day is never mixed in. While a folder's usage
 * for a window or day loads, its newest cached usage, if any, shows in its
 * place and is marked refreshing, so switching windows or passing midnight
 * never empties the chart. Requests go through
 * their own limiter, one folder at a time in list order, separate from the
 * totals' limiter; a request still waiting when nothing shows it any more
 * never starts. The queries take the defaults of their persisted root: they
 * stay fresh for five minutes, refetch on window focus once stale, and are
 * cached across launches. When a folder's usage arrives, still wanted, its usage
 * for earlier days is dropped.
 *
 * @returns The window and the summed usage.
 */
export function useDailyUsage(): DailyUsage {
  const client = useQueryClient()
  const { data: projects } = useProjects()
  const range = useTotalsWindowStore((state) => state.window)
  const todayKey = useTodayKey()

  const folders = useMemo(() => (projects ?? []).map((project) => project.dirName), [projects])
  const combine = useCallback(
    (results: UseQueryResult<ProjectDailyUsageDto>[]): FolderDailyUsageState[] =>
      results.map((result) => stateOf(result, range)),
    [range]
  )

  // The queries are rebuilt only when the folders, window or day change. Until then each folder
  // keeps one placeholder function, so the query observer can tell a placeholder it already
  // computed and not read the cache on every render; a new one searches the cache afresh.
  const queries = useMemo(
    () =>
      folders.map((dirName) => ({
        queryKey: ['projectDailyUsage', dirName, range, todayKey],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const usage = await dailyUsageLimiterFor(client).run(
            async () =>
              unwrapIpcResult(await window.beekeeper.getProjectDailyUsage(dirName, range)),
            signal
          )
          if (!signal.aborted) pruneStaleDailyUsage(client, { dirName, todayKey })
          return usage
        },
        placeholderData: createDailyUsagePlaceholder(client, { dirName, range })
      })),
    [client, folders, range, todayKey]
  )
  const states = useQueries({ queries, combine })

  const summary = useMemo(() => sumDailyUsage(states, DAY_COUNT[range]), [states, range])
  return useMemo(() => ({ window: range, summary }), [range, summary])
}
