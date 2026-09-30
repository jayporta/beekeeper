import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { logRehydrateError } from '@renderer/storage/logRehydrateError'
import { zustandIdbStorage } from '@renderer/storage/zustandIdbStorage'
import { mergeFirstRunState } from './mergeFirstRunState'

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
 * Whether the first-run screen is on show: until it is dismissed, and again
 * while it is reopened from About. The one definition of that, for every reader.
 *
 * @param state - The store's state.
 * @returns `true` while the screen shows.
 */
export function selectIsFirstRunShowing(
  state: Pick<FirstRunState, 'dismissed' | 'isOpen'>
): boolean {
  return !state.dismissed || state.isOpen
}

/**
 * The first-run screen's state. Only `dismissed` is persisted, to IndexedDB
 * through `zustandIdbStorage`. The stored value is validated on load (see
 * `mergeFirstRunState`), and a load that fails is logged. Hydration is started
 * by `useFirstRunHydrated`, so the UI can hold back until the stored value is known.
 */
export const useFirstRunStore = create<FirstRunState>()(
  persist<FirstRunState, [], [], { dismissed: boolean }>(
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
      storage: createJSONStorage(() => zustandIdbStorage),
      partialize: (state) => ({ dismissed: state.dismissed }),
      merge: (persisted, current) => mergeFirstRunState(persisted, current),
      onRehydrateStorage: logRehydrateError(FIRST_RUN_STORAGE_KEY),
      skipHydration: true
    }
  )
)
