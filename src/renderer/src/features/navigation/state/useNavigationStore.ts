import { create } from 'zustand'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'

/** The main area's views: the all-projects overview, a project's sessions list, or one session. */
export type NavigationView = 'overview' | 'sessions' | 'session'

/** Which view the main area shows and what it is showing. */
interface NavigationState {
  /** The view on screen. */
  readonly view: NavigationView
  /** The session on show when `view` is `'session'`, otherwise `null`. */
  readonly selectedSessionRef: SessionRefDto | null
  /** The agent selected within that session, or `null` for the lead. */
  readonly selectedAgentId: string | null
  /** Shows the all-projects overview and clears the selected session and agent. */
  showOverview: () => void
  /** Shows the selected project's sessions list and clears the selected session and agent. */
  showSessions: () => void
  /**
   * Shows one session.
   * @param ref - The session to show.
   * @param agentId - The agent to select within it. Omit it for the lead.
   */
  showSession: (ref: SessionRefDto, agentId?: string) => void
  /** Returns to the starting state: the sessions list with nothing selected. */
  reset: () => void
}

const STARTING_STATE = {
  view: 'sessions',
  selectedSessionRef: null,
  selectedAgentId: null
} as const satisfies Pick<NavigationState, 'view' | 'selectedSessionRef' | 'selectedAgentId'>

/**
 * The main area's navigation. It starts on the sessions list while the
 * overview is a placeholder, and is never persisted, so every launch starts
 * there.
 */
export const useNavigationStore = create<NavigationState>()((set) => ({
  ...STARTING_STATE,
  showOverview: () => {
    set({ ...STARTING_STATE, view: 'overview' })
  },
  showSessions: () => {
    set(STARTING_STATE)
  },
  showSession: (ref, agentId) => {
    set({ view: 'session', selectedSessionRef: ref, selectedAgentId: agentId ?? null })
  },
  reset: () => {
    set(STARTING_STATE)
  }
}))
