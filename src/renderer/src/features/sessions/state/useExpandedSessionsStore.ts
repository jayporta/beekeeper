import { create } from 'zustand'

/** Which sessions' teammates the person opened or closed. */
interface ExpandedSessionsState {
  /** The person's choice for each session, by row key. A session not listed follows the search. */
  readonly expanded: Readonly<Record<string, boolean>>
  /**
   * Flips whether a session's teammates show.
   * @param key - The row's key.
   * @param current - Whether they show now, whatever the reason.
   */
  toggle: (key: string, current: boolean) => void
}

/**
 * The sessions list's open and closed teammate rows. A person's choice wins
 * over the search's auto-expand for as long as the app runs. It is never
 * persisted.
 */
export const useExpandedSessionsStore = create<ExpandedSessionsState>()((set) => ({
  expanded: {},
  toggle: (key, current) => {
    set((state) => ({ expanded: { ...state.expanded, [key]: !current } }))
  }
}))
