import type { WorktreeDiffCodeDto } from '../../../../../shared/ipc/worktreeDiffDto'

/** The note shown for a diff that couldn't be computed, by what the person can do about it. */
export type DiffFailureKey =
  'branchMissing' | 'repoMissing' | 'tooLarge' | 'timeout' | 'tooMany' | 'noBase' | 'failed'

const KEYS: Readonly<Record<WorktreeDiffCodeDto, DiffFailureKey>> = {
  'branch-not-found': 'branchMissing',
  'repo-missing': 'repoMissing',
  'not-a-repo': 'repoMissing',
  'outside-project': 'repoMissing',
  'invalid-path': 'repoMissing',
  'invalid-ref': 'repoMissing',
  'output-too-large': 'tooLarge',
  timeout: 'timeout',
  'too-many-agents': 'tooMany',
  'no-base': 'noBase',
  'no-common-ancestor': 'noBase',
  'git-failed': 'failed',
  'malformed-numstat': 'failed',
  'spawn-failed': 'failed'
}

/**
 * Picks the note for a diff that couldn't be computed. Related codes share a
 * note, since the person can do the same about each.
 *
 * @param code - Why the diff failed.
 * @returns The note's key.
 */
export function diffFailureKey(code: WorktreeDiffCodeDto): DiffFailureKey {
  return KEYS[code]
}
