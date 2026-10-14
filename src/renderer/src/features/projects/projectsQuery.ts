import { queryOptions } from '@tanstack/react-query'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * The first element of the project list's query key, and the root the rules
 * that cover every project query match on. It is part of the persisted
 * cache's format, so its value must not change.
 */
export const PROJECTS_QUERY_ROOT = 'projects'

/**
 * The query that loads the project folders under `~/.claude/projects`. Every
 * reader and writer of the project list takes its key from here, so
 * `getQueryData(projectsQueryOptions.queryKey)` is typed as the list.
 */
export const projectsQueryOptions = queryOptions({
  queryKey: [PROJECTS_QUERY_ROOT],
  queryFn: async () => unwrapIpcResult(await window.beekeeper.listProjects())
})
