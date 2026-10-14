import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { sameAgent } from '../sameAgent'
import { sameSessionRef } from '../sameSessionRef'
import type { NavigationView, SelectedAgent } from './useNavigationStore'

/** How many entries the history keeps. Past it, the oldest is dropped. */
export const HISTORY_LIMIT = 50

/** One place the person was: what Back returns to. */
export interface NavEntry {
  /** The view that was on screen. */
  readonly view: NavigationView
  /** The project the view belonged to, or `null` for the overview, which is about no one project. */
  readonly projectDirName: string | null
  /** The session that was on show, or `null` outside the session view. */
  readonly sessionRef: SessionRefDto | null
  /** The agent that was selected within that session, or `null` for the lead. */
  readonly agent: SelectedAgent | null
}

/** The parts of the navigation state that make up an {@link NavEntry}. */
interface EntryState {
  readonly view: NavigationView
  readonly selectedSessionRef: SessionRefDto | null
  readonly selectedAgent: SelectedAgent | null
  readonly currentProjectDirName: string | null
}

/**
 * The place the navigation state shows now. A session is filed under the
 * project in effect, never the folder its ref names, since a worktree family's
 * sessions live in other folders than the project they are shown under.
 *
 * @param state - The navigation state.
 * @returns The entry for the view on show.
 */
export function entryOf(state: EntryState): NavEntry {
  return {
    view: state.view,
    projectDirName: state.view === 'overview' ? null : state.currentProjectDirName,
    sessionRef: state.selectedSessionRef,
    agent: state.selectedAgent
  }
}

/**
 * Whether two entries are the same place: the same view, project, session and agent.
 *
 * @param a - One entry.
 * @param b - The other entry.
 * @returns `true` when navigating from one to the other would change nothing the person can see.
 */
export function sameEntry(a: NavEntry, b: NavEntry): boolean {
  return (
    a.view === b.view &&
    a.projectDirName === b.projectDirName &&
    sameSessionRef(a.sessionRef, b.sessionRef) &&
    sameAgent(a.agent, b.agent)
  )
}

/**
 * Adds an entry to the end of a history, dropping the oldest ones past {@link HISTORY_LIMIT}.
 *
 * @param history - The entries so far, oldest first.
 * @param entry - The entry to add.
 * @returns A new history. The one given is not changed.
 */
export function appendEntry(history: readonly NavEntry[], entry: NavEntry): readonly NavEntry[] {
  return [...history, entry].slice(-HISTORY_LIMIT)
}
