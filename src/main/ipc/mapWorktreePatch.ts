import { capPatches } from '../../core/git/capPatches'
import type { WorktreeDiffPatch } from '../../core/git/worktreeDiffPatch'
import type { Result } from '../../core/shared/result'
import type { WorktreePatchDto } from '../../shared/ipc/worktreePatchDto'
import type { WorktreeDiffCode } from '../git/sessionWorktreeDiffs'

/**
 * Maps one agent's patch result onto its transfer shape: patches cut to the
 * size caps and decoded as text, or the failure's code alone.
 *
 * @param result - The agent's patches, or why they couldn't be read.
 * @returns The DTO, holding only the whitelisted fields.
 */
export function mapWorktreePatch(
  result: Result<WorktreeDiffPatch, WorktreeDiffCode>
): WorktreePatchDto {
  if (!result.ok) return { kind: 'failed', code: result.error }
  const { files, truncatedTotal } = capPatches(result.value.files)
  return {
    kind: 'ready',
    uncommitted: result.value.uncommitted,
    files: files.map((file) => ({
      path: file.path,
      ...(file.oldPath === undefined ? {} : { oldPath: file.oldPath }),
      patch: file.patch,
      truncated: file.truncated
    })),
    truncatedTotal
  }
}
