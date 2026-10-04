import { create } from 'zustand'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'

/** The main area's views: the all-projects overview, a project's sessions list, or one session. */
export type NavigationView = 'overview' | 'sessions' | 'session'

/**
 * The agent selected within a session: a subagent inside a transcript, by the
 * ref of the session whose transcript holds it and its agent id (a teammate's
 * own subagents are selectable too), or a teammate, by the ref of its own
 * session, which may live in another folder than the lead's.
 */
export type SelectedAgent =
  | { readonly kind: 'subagent'; readonly ownerRef: SessionRefDto; readonly agentId: string }
  | { readonly kind: 'teammate'; readonly ref: SessionRefDto }

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
   * `showSessions`, and `showSession`. `reset` does not count, since the app
   * does it on its own. A change tells the shell to move focus to the new view.
   */
  readonly navigationCount: number
  /** Shows the all-projects overview and clears the selected session and agent. */
  showOverview: () => void
  /** Shows the selected project's sessions list and clears the selected session and agent. */
  showSessions: () => void
  /**
   * Shows one session.
   * @param ref - The session to show.
   * @param agent - The agent to select within it. Omit it for the lead.
   */
  showSession: (ref: SessionRefDto, agent?: SelectedAgent) => void
  /** Returns to the starting state: the sessions list with nothing selected. */
  reset: () => void
}

const STARTING_STATE = {
  view: 'sessions',
  selectedSessionRef: null,
  selectedAgent: null
} as const satisfies Pick<NavigationState, 'view' | 'selectedSessionRef' | 'selectedAgent'>

/**
 * The main area's navigation. It starts on the sessions list while the
 * overview is a placeholder, and is never persisted, so every launch starts
 * there.
 */
export const useNavigationStore = create<NavigationState>()((set) => ({
  ...STARTING_STATE,
  navigationCount: 0,
  showOverview: () => {
    set((state) => ({
      ...STARTING_STATE,
      view: 'overview',
      navigationCount: state.navigationCount + 1
    }))
  },
  showSessions: () => {
    set((state) => ({ ...STARTING_STATE, navigationCount: state.navigationCount + 1 }))
  },
  showSession: (ref, agent) => {
    set((state) => ({
      view: 'session',
      selectedSessionRef: ref,
      selectedAgent: agent ?? null,
      navigationCount: state.navigationCount + 1
    }))
  },
  reset: () => {
    set(STARTING_STATE)
  }
}))
