import { create } from 'zustand'

/** What the sessions view remembers while the app runs. Not persisted. */
interface SessionsViewState {
  /** The search text. */
  readonly query: string
  /** Sets the search text. */
  setQuery: (query: string) => void
}

/** The sessions view's search text. */
export const useSessionsViewStore = create<SessionsViewState>()((set) => ({
  query: '',
  setQuery: (query) => {
    set({ query })
  }
}))
