import { create } from 'zustand'
import type { ProjectSortKey } from '../sortProjects'

/** How the projects table is ordered. */
interface ProjectSortState {
  /** The order the table uses. */
  readonly sort: ProjectSortKey
  /** Changes the order. */
  setSort: (sort: ProjectSortKey) => void
}

/** The order the app starts with: the busiest project first. */
export const DEFAULT_PROJECT_SORT: ProjectSortKey = 'tokens'

/**
 * The order of the overview's projects table. It lasts for the app session
 * and is never persisted, so every launch starts sorted by tokens.
 */
export const useProjectSortStore = create<ProjectSortState>()((set) => ({
  sort: DEFAULT_PROJECT_SORT,
  setSort: (sort) => {
    set({ sort })
  }
}))
