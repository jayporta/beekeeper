import type { SubagentMetaFailureReason } from './subagentMetaStatus'

/**
 * Whether a meta failure can clear on a live session without the file being
 * replaced: the file may be mid-write (`invalid-json`), not yet there
 * (`missing`), or briefly unreadable (`unreadable`). The others
 * (`invalid-shape`, `too-large`, `symlink`, `not-a-file`) describe the file as
 * it stands and repeat on every read.
 *
 * @param reason - Why the meta failed.
 * @returns `true` when a later read of the same file may succeed.
 */
export function isTransientMetaFailure(reason: SubagentMetaFailureReason): boolean {
  switch (reason) {
    case 'unreadable':
    case 'missing':
    case 'invalid-json':
      return true
    case 'invalid-shape':
    case 'too-large':
    case 'symlink':
    case 'not-a-file':
      return false
  }
}

/**
 * Whether a meta failure can still clear once the session has been quiet for
 * the archive's waiting period. A meta file is written when its subagent
 * spawns, so on a quiet session an `invalid-json` file is truncated or
 * damaged, not mid-write: it is transient while the session is live
 * ({@link isTransientMetaFailure}) and settled once quiet. Only an I/O
 * failure (`unreadable`) or a file that appears later (`missing`) can still
 * clear.
 *
 * @param reason - Why the meta failed.
 * @returns `true` when a later read of a quiet session's meta may succeed.
 */
export function canClearOnceQuiet(reason: SubagentMetaFailureReason): boolean {
  switch (reason) {
    case 'unreadable':
    case 'missing':
      return true
    case 'invalid-json':
    case 'invalid-shape':
    case 'too-large':
    case 'symlink':
    case 'not-a-file':
      return false
  }
}
