import type {
  GitAvailabilityDto,
  UncommittedStatusDto,
  WorktreeDiffCodeDto
} from '../../../shared/ipc/worktreeDiffDto'
import type { PaneErrorCode } from '../shared/paneErrorCode'

/** How many changed files a stored diff keeps; the count of all of them is kept beside. */
export const MAX_DIFF_FILES = 200

/** How many untracked paths a stored diff keeps; the count of all of them is kept beside. */
export const MAX_UNTRACKED = 50

/** One changed file of a worktree branch, cleaned. */
export interface PaneDiffFile {
  /** The file's path, or its new path for a rename, cleaned of unprintable characters. */
  readonly path: string
  /** The path before a rename, cleaned, or `null`. */
  readonly oldPath: string | null
  /** Lines added, or `null` for a binary file. */
  readonly added: number | null
  /** Lines deleted, or `null` for a binary file. */
  readonly deleted: number | null
}

/** What a worktree diff came to: the changes, or the service's code for why it has none. */
export type PaneDiffResult =
  | {
      readonly ok: true
      /** Whether the files include uncommitted work, and why not when they don't. */
      readonly uncommitted: UncommittedStatusDto
      /** The first {@link MAX_DIFF_FILES} changed files. */
      readonly files: readonly PaneDiffFile[]
      /** How many files changed in all. */
      readonly fileCount: number
      /** The first {@link MAX_UNTRACKED} untracked paths, cleaned. */
      readonly untracked: readonly string[]
      /** How many untracked paths there are in all. */
      readonly untrackedCount: number
    }
  | { readonly ok: false; readonly code: WorktreeDiffCodeDto }

/** The selected agent's worktree diff, or why there isn't one. Plain data for `$.state`. */
export interface PaneDiffs {
  /** The viewed session (the pane view's `sessionId`) the diff was loaded for. */
  readonly sessionId: string
  /** The key of the node the diff is for, or an empty string when `status` is `none` without a tree. */
  readonly key: string
  /** How the data stands. `none` is a selected node with no worktree branch (or no tree), which has nothing to load. */
  readonly status: 'loading' | 'ready' | 'error' | 'none'
  /** A service failure's code when `status` is `error`, otherwise `null`. */
  readonly errorCode: PaneErrorCode | null
  /** Git's availability; `null` until loaded. Anything but `ok` draws a fixed line. */
  readonly git: GitAvailabilityDto | null
  /** The agent's diff or its failure code, or `null` when git isn't usable or the service had no entry for it. */
  readonly result: PaneDiffResult | null
  /** When the diff was stored, in milliseconds since the epoch. */
  readonly refreshedAtMs: number
}
