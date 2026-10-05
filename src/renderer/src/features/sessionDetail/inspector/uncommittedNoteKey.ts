import type { UncommittedStatusDto } from '../../../../../shared/ipc/worktreeDiffDto'

/** The note shown when a diff leaves out uncommitted work, by why it was left out. */
export type UncommittedNoteKey =
  'uncommittedFilters' | 'uncommittedMismatch' | 'uncommittedNoWorktree'

const KEYS: Readonly<Record<UncommittedStatusDto, UncommittedNoteKey | null>> = {
  included: null,
  'skipped-filters': 'uncommittedFilters',
  'worktree-mismatch': 'uncommittedMismatch',
  'no-worktree': 'uncommittedNoWorktree'
}

/**
 * Picks the note for a diff that shows committed changes only.
 *
 * @param status - How the diff handled uncommitted work.
 * @returns The note's key, or `null` when uncommitted work is included.
 */
export function uncommittedNoteKey(status: UncommittedStatusDto): UncommittedNoteKey | null {
  return KEYS[status]
}
