import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'
import type { PaneErrorCode } from '../pane/paneView'

/** How many rows, leads and teammates together, the Browse screen keeps. The rest are counted. */
export const MAX_BROWSE_ROWS = 100

/** One project in the picker. */
export interface BrowseProject {
  /** The project folder's name. */
  readonly dirName: string
  /** The name to show, cleaned of unprintable characters. A worktree reads `<parent> / <worktree>`. */
  readonly label: string
}

/** One session row of the Browse screen. Every string is cleaned and the row is plain data, so it can sit in `$.state`. */
export interface BrowseRow {
  /** The session's key across folders. */
  readonly key: string
  /** The session in its own folder, which can differ from the picked project (a worktree's sessions are listed with its project). */
  readonly ref: SessionRefDto
  /** The session's name, on one line. */
  readonly label: string
  /** `0` for a lead or a lone session, `1` for a teammate under its lead. */
  readonly depth: 0 | 1
  /** The tokens the desktop card shows, or `null` when there is no figure. */
  readonly tokens: number | null
  /** Whether `tokens` leaves something out. */
  readonly tokensPartial: boolean
  /** When the session was last active, in milliseconds since the epoch, or `null` when unknown. */
  readonly lastActiveMs: number | null
  /** The agents the session used, in words, or `null` when it has none or that can't be told. */
  readonly agents: string | null
}

/** How the Browse data stands. */
export type BrowseStatus = 'loading' | 'ready' | 'error'

/** What the Browse screen draws. Plain data. */
export interface BrowseView {
  /** How the data stands. */
  readonly status: BrowseStatus
  /** The failure's code when `status` is `error`, otherwise `null`. Never a message. */
  readonly errorCode: PaneErrorCode | null
  /** The projects, each followed by its worktrees. Empty until they are listed. */
  readonly projects: readonly BrowseProject[]
  /** The picked project's folder, or `null` when there is none. */
  readonly projectDirName: string | null
  /** The picked project's sessions, at most {@link MAX_BROWSE_ROWS}. */
  readonly rows: readonly BrowseRow[]
  /** How many rows were left out by the cap. */
  readonly hiddenCount: number
  /** When the view's content last changed, in milliseconds since the epoch. */
  readonly refreshedAtMs: number
}
