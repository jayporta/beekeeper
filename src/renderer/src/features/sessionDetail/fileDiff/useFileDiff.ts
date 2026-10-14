import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { FileDiffDto } from '../../../../../shared/ipc/fileDiffDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import type { FileDiffTarget } from './fileDiffTarget'

/**
 * Loads what one agent changed in one file. It reads a transcript and can be
 * large, so only the open dialog calls it, and the result is neither persisted
 * nor kept: closing the dialog drops it.
 *
 * @param target - The agent and file to load.
 * @returns The diff query. A failed call surfaces as an `IpcCallError`.
 */
export function useFileDiff(target: FileDiffTarget): UseQueryResult<FileDiffDto> {
  const { ref, agentId, filePath } = target
  return useQuery({
    queryKey: ['fileDiff', ref.projectDirName, ref.sessionId, agentId, filePath],
    queryFn: async () =>
      unwrapIpcResult(
        await window.beekeeper.getFileDiff({
          projectDirName: ref.projectDirName,
          sessionId: ref.sessionId,
          agentId,
          filePath
        })
      ),
    gcTime: 0
  })
}
