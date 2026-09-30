import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { idbStorage } from '@renderer/storage/idbStorage'

/** The IndexedDB key the first-run state is stored under. */
export const FIRST_RUN_STORAGE_KEY = 'first-run'

/** What the app remembers about the first-run screen. */
interface FirstRunState {
  /** Whether the person has pressed "Got it". Persisted across launches. */
  readonly dismissed: boolean
  /** Whether the screen was reopened from the sidebar. Not persisted. */
  readonly isOpen: boolean
  /** Records that the person has seen the screen and closes it. */
  dismiss: () => void
  /** Reopens the screen, for the About control. */
  open: () => void
}

/**
 * The first-run screen's state. Only `dismissed` is persisted, to IndexedDB
 * through `idbStorage`. Hydration is started by `useFirstRunHydrated`, so the
 * UI can hold back until the stored value is known.
 */
export const useFirstRunStore = create<FirstRunState>()(
  persist(
    (set) => ({
      dismissed: false,
      isOpen: false,
      dismiss: () => {
        set({ dismissed: true, isOpen: false })
      },
      open: () => {
        set({ isOpen: true })
      }
    }),
    {
      name: FIRST_RUN_STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ dismissed: state.dismissed }),
      skipHydration: true
    }
  )
)
