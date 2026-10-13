import type { PaneErrorCode, PaneStatus, PaneView } from './paneView'

/** What {@link emptyPaneView} needs. */
interface EmptyPaneViewInput {
  /** The session the view is of; empty when it couldn't be read. */
  readonly sessionId: string
  /** Why there is no tree. */
  readonly status: Exclude<PaneStatus, 'ready'>
  /** The failure's code for an `error` view, otherwise `null`. */
  readonly errorCode: PaneErrorCode | null
  /** When the view is built, in milliseconds since the epoch. */
  readonly nowMs: number
}

/**
 * A view with no tree: the pane is loading, waiting for the session's first
 * transcript, or failed with a code.
 *
 * @param input - The session, status, error code and time.
 * @returns The view.
 */
export function emptyPaneView(input: EmptyPaneViewInput): PaneView {
  return {
    sessionId: input.sessionId,
    status: input.status,
    errorCode: input.errorCode,
    label: null,
    totalTokens: null,
    totalTokensPartial: false,
    root: null,
    refreshedAtMs: input.nowMs
  }
}
