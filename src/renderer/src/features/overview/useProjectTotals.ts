import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ProjectTotalsDto, TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { useProjects } from '@renderer/features/projects/useProjects'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import type { FolderTotalsState } from './folderTotalsState'
import type { TotalsByFolder } from './projectTotalsOf'
import { useTotalsWindowStore } from './state/useTotalsWindowStore'
import { totalsLimiterFor } from './totalsLimiter'

const OTHER_WINDOW: Readonly<Record<TotalsWindowDto, TotalsWindowDto>> = {
  '7d': '30d',
  '30d': '7d'
}

const LOADING: FolderTotalsState = { status: 'loading' }

function stateOf(result: UseQueryResult<ProjectTotalsDto>): FolderTotalsState {
  // Data wins over a failed background refresh, so figures on screen stay on screen.
  if (result.data !== undefined) {
    return { status: 'ready', totals: result.data, refreshing: result.isPlaceholderData }
  }
  if (result.isError) return { status: 'error', code: IpcCallError.codeOf(result.error) }
  return { status: 'loading' }
}

/** What {@link useProjectTotals} returns. */
export interface ProjectTotals {
  /** The window the totals cover. */
  readonly window: TotalsWindowDto
  /** Each listed folder's totals state, by folder name. Empty until the project list loads. */
  readonly byFolder: TotalsByFolder
}

/**
 * Loads every listed folder's totals for the chosen window: one query per
 * folder, keyed by folder and window, so a project's card and its sidebar row
 * read the same data, and a folder's result is cached under each window.
 *
 * @remarks
 * Main reads each folder's sessions, so the requests are limited to two in
 * flight, first come first served, with the selected folder first and the
 * rest in list order. That leaves the summary reads behind them free for the
 * session list a person opens. A request still waiting when nobody shows it
 * any more never starts. While a folder's totals for a window load, its totals
 * for the other window, if cached, show in their place and are marked
 * refreshing, so switching windows never empties the screen. The queries
 * take the defaults of the persisted roots: they are fresh for ten seconds,
 * refetch on window focus once stale, and are cached across launches.
 *
 * @returns The window and each folder's totals state.
 */
export function useProjectTotals(): ProjectTotals {
  const client = useQueryClient()
  const { data: projects } = useProjects()
  const selected = useSelectedProjectDirName()
  const range = useTotalsWindowStore((state) => state.window)

  const folders = useMemo(() => {
    const names = (projects ?? []).map((project) => project.dirName)
    return selected === null || !names.includes(selected)
      ? names
      : [selected, ...names.filter((name) => name !== selected)]
  }, [projects, selected])

  const combine = useCallback(
    (results: UseQueryResult<ProjectTotalsDto>[]): TotalsByFolder =>
      new Map(
        folders.map((dirName, index) => {
          const result = results[index]
          return [dirName, result === undefined ? LOADING : stateOf(result)]
        })
      ),
    [folders]
  )

  const byFolder = useQueries({
    queries: folders.map((dirName) => ({
      queryKey: ['projectTotals', dirName, range],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        totalsLimiterFor(client).run(
          async () => unwrapIpcResult(await window.beekeeper.getProjectTotals(dirName, range)),
          signal
        ),
      placeholderData: () =>
        client.getQueryData<ProjectTotalsDto>(['projectTotals', dirName, OTHER_WINDOW[range]])
    })),
    combine
  })

  return { window: range, byFolder }
}
