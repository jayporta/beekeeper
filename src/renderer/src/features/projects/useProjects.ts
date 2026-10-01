import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * Loads the project folders under `~/.claude/projects`. A failed call
 * surfaces as an `IpcCallError` on the query's `error`.
 *
 * @returns The project list query.
 */
export function useProjects(): UseQueryResult<readonly ProjectDto[]> {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => unwrapIpcResult(await window.beekeeper.listProjects())
  })
}
