import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { logRehydrateError } from '@renderer/storage/logRehydrateError'
import { zustandIdbStorage } from '@renderer/storage/zustandIdbStorage'
import { mergeSelectedProjectState } from './mergeSelectedProjectState'

/** The IndexedDB key the project selection is stored under. */
export const SELECTED_PROJECT_STORAGE_KEY = 'selected-project'

/** Which project the person last selected, and the folder that went missing. */
interface SelectedProjectState {
  /** The selected project's folder name, or `null` when none was chosen. */
  readonly selectedDirName: string | null
  /**
   * The folder name of a selected project whose folder no longer exists, or
   * `null`. It is never persisted. It lets the app say why the selection changed.
   */
  readonly goneDirName: string | null
  /** Selects a project by folder name, and drops any recorded missing folder. */
  select: (dirName: string) => void
  /**
   * Forgets the selection because its folder no longer exists, so the first
   * parent project is used, and records the folder.
   */
  forgetGoneFolder: (dirName: string) => void
  /**
   * Drops the recorded missing folder and keeps the selection. It changes
   * nothing, and so writes nothing, when no folder is recorded.
   */
  clearGoneFolder: () => void
  /**
   * Selects a folder again when it was recorded as gone and has come back, so
   * the person's original choice returns and the record is dropped. It
   * changes nothing, and so writes nothing, for any other folder.
   */
  restoreFolder: (dirName: string) => void
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
    (set, get) => ({
      selectedDirName: null,
      goneDirName: null,
      select: (dirName) => {
        set({ selectedDirName: dirName, goneDirName: null })
      },
      forgetGoneFolder: (dirName) => {
        set({ selectedDirName: null, goneDirName: dirName })
      },
      clearGoneFolder: () => {
        if (get().goneDirName === null) return
        set({ goneDirName: null })
      },
      restoreFolder: (dirName) => {
        if (get().goneDirName !== dirName) return
        set({ selectedDirName: dirName, goneDirName: null })
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
