import { create } from 'zustand'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { appendEntry, entryOf, sameEntry, type NavEntry } from './navigationHistory'

/** The main area's views: the all-projects overview, a project's sessions list, or one session. */
export type NavigationView = 'overview' | 'sessions' | 'session'

/**
 * The agent selected within a session: a subagent inside a transcript, by the
 * ref of the session whose transcript holds it and its agent id (a teammate's
 * own subagents are selectable too), or a teammate, by the ref of its own
 * session, which may live in another folder than the lead's, or a workflow
 * run, by the ref of the session whose transcripts hold its agents and its
 * run id.
 */
export type SelectedAgent =
  | { readonly kind: 'subagent'; readonly ownerRef: SessionRefDto; readonly agentId: string }
  | { readonly kind: 'teammate'; readonly ref: SessionRefDto }
  | { readonly kind: 'workflow'; readonly ownerRef: SessionRefDto; readonly runId: string }

/** Which view the main area shows and what it is showing. */
interface NavigationState {
  /** The view on screen. */
  readonly view: NavigationView
  /** The session on show when `view` is `'session'`, otherwise `null`. */
  readonly selectedSessionRef: SessionRefDto | null
  /** The agent selected within that session, or `null` for the lead. */
  readonly selectedAgent: SelectedAgent | null
  /**
   * How many times the person has navigated: every `showOverview`,
   * `showSessions`, `showSession`, `replaceWithSessions`, and `restore`.
   * `reset` does not count, since the app does it on its own. A change tells
   * the shell to move focus to the new view.
   */
  readonly navigationCount: number
  /**
   * The folder name of the project in effect, which the app keeps in step with
   * the projects feature. A history entry names this project, never the
   * folder a session's ref names. It is `null` until a project is known.
   */
  readonly currentProjectDirName: string | null
  /** The places the person left, oldest first, capped at `HISTORY_LIMIT`. Never persisted. */
  readonly history: readonly NavEntry[]
  /**
   * The project a Back is about to select, or `null`. Selecting it is a project
   * change the app would answer with `reset`; this marks that change as
   * intended, so the restored view is kept. It is cleared by the next
   * `syncProject`.
   */
  readonly restoringProject: string | null
  /** Shows the all-projects overview and clears the selected session and agent. */
  showOverview: () => void
  /**
   * Shows a project's sessions list and clears the selected session and agent.
   * @param dirName - The project to show, for a call that selects it in the same step. Omit it for the project in effect.
   */
  showSessions: (dirName?: string) => void
  /**
   * Shows one session.
   * @param ref - The session to show.
   * @param agent - The agent to select within it. Omit it for the lead.
   */
  showSession: (ref: SessionRefDto, agent?: SelectedAgent) => void
  /**
   * Shows the sessions list in place of the view on screen, which is not
   * recorded in the history. It leaves a session that no longer exists, so Back
   * never returns to it. The newest entry is dropped when it is the place this
   * shows, which is the sessions list the session was opened from, so Back
   * does not offer the place already on screen.
   */
  replaceWithSessions: () => void
  /**
   * Selects an agent within the session on show. Choosing among a session's
   * agents is not navigating, so it leaves `navigationCount` alone and focus
   * stays where it is.
   * @param agent - The agent to select, or `null` for the lead.
   */
  selectAgent: (agent: SelectedAgent | null) => void
  /**
   * Returns to the starting state: the sessions list with nothing selected.
   * The history is left alone, since the app does this on its own.
   */
  reset: () => void
  /**
   * Removes the newest history entry without showing it.
   * @returns The entry, or `undefined` when the history is empty.
   */
  popEntry: () => NavEntry | undefined
  /**
   * Shows an entry, as a navigation that is not recorded in the history. It
   * does not select the entry's project: the caller does, after
   * `markRestoringProject`.
   * @param entry - The place to show.
   */
  restore: (entry: NavEntry) => void
  /**
   * Marks the project that is about to be selected as intended (see `restoringProject`).
   * @param dirName - The folder name of the project.
   */
  markRestoringProject: (dirName: string) => void
  /**
   * Records the project in effect, and clears the restoring mark.
   * @param dirName - The folder name of the project now in effect.
   */
  syncProject: (dirName: string) => void
}

const STARTING_STATE = {
  view: 'sessions',
  selectedSessionRef: null,
  selectedAgent: null
} as const satisfies Pick<NavigationState, 'view' | 'selectedSessionRef' | 'selectedAgent'>

/** What a navigation to `entry` sets, apart from the history. */
function showEntry(
  state: NavigationState,
  entry: NavEntry
): Pick<
  NavigationState,
  'view' | 'selectedSessionRef' | 'selectedAgent' | 'navigationCount' | 'currentProjectDirName'
> {
  return {
    view: entry.view,
    selectedSessionRef: entry.sessionRef,
    selectedAgent: entry.agent,
    navigationCount: state.navigationCount + 1,
    currentProjectDirName: entry.projectDirName ?? state.currentProjectDirName
  }
}

/** Shows `entry`, and records the place being left unless it is the same place. */
function navigateTo(state: NavigationState, entry: NavEntry): Partial<NavigationState> {
  const left = entryOf(state)
  return {
    ...showEntry(state, entry),
    history: sameEntry(left, entry) ? state.history : appendEntry(state.history, left)
  }
}

/** The overview, which belongs to no one project. */
const OVERVIEW_ENTRY: NavEntry = {
  view: 'overview',
  projectDirName: null,
  sessionRef: null,
  agent: null
}

/** A project's sessions list, with nothing selected. */
function sessionsEntry(projectDirName: string | null): NavEntry {
  return { view: 'sessions', projectDirName, sessionRef: null, agent: null }
}

/**
 * The main area's navigation. It starts on the sessions list and is never
 * persisted, so every launch starts there.
 */
export const useNavigationStore = create<NavigationState>()((set, get) => ({
  ...STARTING_STATE,
  navigationCount: 0,
  currentProjectDirName: null,
  history: [],
  restoringProject: null,
  showOverview: () => {
    set((state) => navigateTo(state, OVERVIEW_ENTRY))
  },
  showSessions: (dirName) => {
    set((state) => navigateTo(state, sessionsEntry(dirName ?? state.currentProjectDirName)))
  },
  showSession: (ref, agent) => {
    set((state) =>
      navigateTo(state, {
        view: 'session',
        projectDirName: state.currentProjectDirName,
        sessionRef: ref,
        agent: agent ?? null
      })
    )
  },
  replaceWithSessions: () => {
    set((state) => {
      const target = sessionsEntry(state.currentProjectDirName)
      const newest = state.history.at(-1)
      const leftFromHere = newest !== undefined && sameEntry(newest, target)
      return {
        ...showEntry(state, target),
        history: leftFromHere ? state.history.slice(0, -1) : state.history
      }
    })
  },
  selectAgent: (agent) => {
    set({ selectedAgent: agent })
  },
  reset: () => {
    set(STARTING_STATE)
  },
  popEntry: () => {
    const entry = get().history.at(-1)
    if (entry !== undefined) set((state) => ({ history: state.history.slice(0, -1) }))
    return entry
  },
  restore: (entry) => {
    set((state) => showEntry(state, entry))
  },
  markRestoringProject: (dirName) => {
    set({ restoringProject: dirName })
  },
  syncProject: (dirName) => {
    set({ currentProjectDirName: dirName, restoringProject: null })
  }
}))
