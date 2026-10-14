import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'

/**
 * Which screen the pane shows. A missing value means `current`. Only the pane's own press
 * handlers write it.
 */
export type PaneNav =
  | { readonly screen: 'current' }
  | { readonly screen: 'browse'; readonly projectDirName: string | null }
  | { readonly screen: 'session'; readonly ref: SessionRefDto; readonly backTo: string }

/** The session a pane view is built for, and whether it is the engine's own session or one the person browsed to. */
export interface PaneTarget {
  /** The session. */
  readonly ref: SessionRefDto
  /** `current` for the engine's session, `browsed` for another. */
  readonly target: 'current' | 'browsed'
}

/**
 * The session the pane's tree shows: the browsed one on the session screen, otherwise the engine's own.
 *
 * @param nav - The stored nav, or `undefined` when none is.
 * @param current - The engine's own session.
 * @returns The session and which of the two it is.
 */
export function targetOf(nav: PaneNav | undefined, current: SessionRefDto): PaneTarget {
  return nav?.screen === 'session'
    ? { ref: nav.ref, target: 'browsed' }
    : { ref: current, target: 'current' }
}
