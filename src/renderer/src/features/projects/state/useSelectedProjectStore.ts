import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { logRehydrateError } from '@renderer/storage/logRehydrateError'
import { zustandIdbStorage } from '@renderer/storage/zustandIdbStorage'
import { mergeSelectedProjectState } from './mergeSelectedProjectState'

/** The IndexedDB key the project selection is stored under. */
export const SELECTED_PROJECT_STORAGE_KEY = 'selected-project'

/** Which project the person last selected. */
interface SelectedProjectState {
  /** The selected project's folder name, or `null` when none was chosen. */
  readonly selectedDirName: string | null
  /** Selects a project by folder name. */
  select: (dirName: string) => void
  /** Forgets the selection, so the first parent project is used. */
  resetSelection: () => void
}

/**
 * The project selection, persisted to IndexedDB through `zustandIdbStorage`. This is
 * only the stored choice: whether it is still listed is decided by
 * `pickProject`. The stored value is validated on load (see
 * `mergeSelectedProjectState`), and a load that fails is logged. Hydration is
 * started by `usePersistHydrated`.
 */
export const useSelectedProjectStore = create<SelectedProjectState>()(
  persist<SelectedProjectState, [], [], { selectedDirName: string | null }>(
    (set) => ({
      selectedDirName: null,
      select: (dirName) => {
        set({ selectedDirName: dirName })
      },
      resetSelection: () => {
        set({ selectedDirName: null })
      }
    }),
    {
      name: SELECTED_PROJECT_STORAGE_KEY,
      storage: createJSONStorage(() => zustandIdbStorage),
      partialize: (state) => ({ selectedDirName: state.selectedDirName }),
      merge: (persisted, current) => mergeSelectedProjectState(persisted, current),
      onRehydrateStorage: logRehydrateError(SELECTED_PROJECT_STORAGE_KEY),
      skipHydration: true
    }
  )
)
