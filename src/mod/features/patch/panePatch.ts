import type { UncommittedStatusDto, WorktreeDiffCodeDto } from '../../../shared/ipc/worktreeDiffDto'
import type { PaneErrorCode } from '../shared/paneErrorCode'

/** How many characters of patch text the pane draws in all; the engine draws at most 100,000 characters per drawing. */
export const PATCH_CHAR_BUDGET = 40_000

/** One changed file's patch, cleaned. */
export interface PanePatchFile {
  /** The file's path, or its new path for a rename, cleaned of unprintable characters. */
  readonly path: string
  /** The path before a rename, cleaned, or `null`. */
  readonly oldPath: string | null
  /** The patch text, cleaned per line, cut at a whole hunk when a cap ran out. Never empty. */
  readonly text: string
  /** Whether the service's caps or the pane's budget cut this file's patch. */
  readonly truncated: boolean
}

/** Why a patch has no files. */
export type PanePatchFailure =
  { readonly git: 'git-not-found' | 'git-too-old' } | { readonly code: WorktreeDiffCodeDto }

/**
 * The selected agent's worktree patch, or the request for one. Plain data for `$.state`.
 * `loading` is a press waiting for the refresher, `none` is no patch shown.
 */
export interface PanePatch {
  /** The viewed session the patch is for. */
  readonly sessionId: string
  /** The key of the node the patch is for. */
  readonly key: string
  /** How the data stands. */
  readonly status: 'none' | 'loading' | 'ready' | 'error'
  /** A service failure's code when `status` is `error`, otherwise `null`. */
  readonly errorCode: PaneErrorCode | null
  /** Why a ready patch has no files, or `null`. */
  readonly failure: PanePatchFailure | null
  /** The files, within the budget. */
  readonly files: readonly PanePatchFile[]
  /** Files left out because the budget was spent before them, or the service's total cap left them empty. */
  readonly omittedCount: number
  /** Whether the files include uncommitted work, or `null` until loaded. */
  readonly uncommitted: UncommittedStatusDto | null
  /** When the patch was stored, in milliseconds since the epoch. */
  readonly refreshedAtMs: number
}

/** What the pane needs to show and drive the patch. */
export interface PatchPane {
  /** The patch in state, or `undefined` before any press. */
  readonly stored: PanePatch | undefined
  /** Asks for the patch of the node with this key; runs when `Show patch` is pressed. */
  readonly onShow: (key: string) => void | Promise<void>
  /** Hides the patch; runs when `Hide patch` is pressed. */
  readonly onHide: () => void | Promise<void>
}

/**
 * A patch with no files, in the given state.
 *
 * @param input - The session and node, the status, and the time.
 * @returns A `none`, `loading` or `error` patch.
 */
export function emptyPanePatch(input: {
  readonly sessionId: string
  readonly key: string
  readonly status: PanePatch['status']
  readonly errorCode?: PaneErrorCode
  readonly nowMs: number
}): PanePatch {
  const { sessionId, key, status, errorCode = null, nowMs } = input
  return {
    sessionId,
    key,
    status,
    errorCode,
    failure: null,
    files: [],
    omittedCount: 0,
    uncommitted: null,
    refreshedAtMs: nowMs
  }
}
