import { create } from 'zustand'

/** Which project groups the person opened or closed in the sidebar. */
interface ExpandedProjectsState {
  /** Groups the person opened or closed, by top-level folder name. A group not listed follows the default. */
  readonly toggled: Readonly<Record<string, boolean>>
  /** Opens or closes a group's worktrees. */
  setExpanded: (dirName: string, expanded: boolean) => void
}

/**
 * The sidebar's open and closed worktree groups, shared by the group rows. It
 * is never persisted, so every launch starts with the default.
 */
export const useExpandedProjectsStore = create<ExpandedProjectsState>()((set) => ({
  toggled: {},
  setExpanded: (dirName, expanded) => {
    set((state) => ({ toggled: { ...state.toggled, [dirName]: expanded } }))
  }
}))
