import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { logRehydrateError } from '@renderer/storage/logRehydrateError'
import { zustandIdbStorage } from '@renderer/storage/zustandIdbStorage'
import { DEFAULT_SIDEBAR_WIDTH, clampSidebarWidth } from '@renderer/app/sidebarWidth'

/** The IndexedDB key the sidebar width is stored under. */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width'

/** The sidebar's width as the person last set it. */
interface SidebarWidthState {
  /** The width in px, before the window's size limits it (see `clampSidebarWidth`). */
  readonly width: number
  /** Sets the width in px. */
  setWidth: (px: number) => void
}

/**
 * The sidebar's width, persisted to IndexedDB through `zustandIdbStorage`. A
 * stored value is validated on load: a number is clamped to the absolute
 * range, anything else leaves the default. Hydration is started by
 * `usePersistHydrated`.
 */
export const useSidebarWidthStore = create<SidebarWidthState>()(
  persist<SidebarWidthState, [], [], { width: number }>(
    (set) => ({
      width: DEFAULT_SIDEBAR_WIDTH,
      setWidth: (px) => {
        set({ width: px })
      }
    }),
    {
      name: SIDEBAR_WIDTH_STORAGE_KEY,
      storage: createJSONStorage(() => zustandIdbStorage),
      partialize: (state) => ({ width: state.width }),
      merge: (persisted, current) => {
        if (typeof persisted !== 'object' || persisted === null || !('width' in persisted)) {
          return current
        }
        const { width } = persisted
        if (typeof width !== 'number' || !Number.isFinite(width)) return current
        // No window is known yet, so only the absolute range applies.
        return { ...current, width: clampSidebarWidth(width, Number.POSITIVE_INFINITY) }
      },
      onRehydrateStorage: logRehydrateError(SIDEBAR_WIDTH_STORAGE_KEY),
      skipHydration: true
    }
  )
)
