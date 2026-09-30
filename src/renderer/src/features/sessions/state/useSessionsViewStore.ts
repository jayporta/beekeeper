import { create } from 'zustand'

/** What the sessions view remembers while the app runs. Not persisted. */
interface SessionsViewState {
  /** The search text. */
  readonly query: string
  /** The keys of the leads whose teammates are shown. */
  readonly expanded: ReadonlySet<string>
  /** Sets the search text. */
  setQuery: (query: string) => void
  /** Expands a collapsed lead, or collapses an expanded one. */
  toggle: (key: string) => void
  /** Collapses every lead. Does nothing, and notifies no one, when none is expanded. */
  collapseAll: () => void
}

/** The sessions view's search text and which leads are expanded. */
export const useSessionsViewStore = create<SessionsViewState>()((set) => ({
  query: '',
  expanded: new Set<string>(),
  setQuery: (query) => {
    set({ query })
  },
  toggle: (key) => {
    set((state) => {
      const expanded = new Set(state.expanded)
      if (!expanded.delete(key)) expanded.add(key)
      return { expanded }
    })
  },
  collapseAll: () => {
    set((state) => (state.expanded.size === 0 ? state : { expanded: new Set<string>() }))
  }
}))
