import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * Loads the version of the running app. It never changes while the app runs,
 * so it is read once and never refetched. It is not persisted, since a saved
 * copy could outlive an update. A failed call surfaces as an `IpcCallError` on
 * the query's `error`.
 *
 * @returns The version query.
 */
export function useAppVersion(): UseQueryResult<string> {
  return useQuery({
    queryKey: ['appVersion'],
    queryFn: async () => unwrapIpcResult(await window.beekeeper.getAppVersion()),
    staleTime: Infinity
  })
}
