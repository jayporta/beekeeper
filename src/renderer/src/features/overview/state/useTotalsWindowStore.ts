import { create } from 'zustand'
import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'

/** Which window the totals cover. */
interface TotalsWindowState {
  /** How far back the totals reach. */
  readonly window: TotalsWindowDto
  /** Changes the window. */
  setWindow: (window: TotalsWindowDto) => void
}

/** The window the app starts with: the last 7 days. */
export const DEFAULT_TOTALS_WINDOW: TotalsWindowDto = '7d'

/**
 * The window of the totals shown on the overview and in the sidebar. It is
 * shared, so the sidebar's figures always match the overview's, and it is
 * never persisted, so every launch starts at 7 days.
 */
export const useTotalsWindowStore = create<TotalsWindowState>()((set) => ({
  window: DEFAULT_TOTALS_WINDOW,
  setWindow: (window) => {
    set({ window })
  }
}))
