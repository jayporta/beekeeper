import { create } from 'zustand'

/** Whether live updates run, and whether they can. */
interface LiveUpdatesState {
  /** Whether the user turned live updates off. */
  readonly paused: boolean
  /** Whether live updates stopped for good, so the control is disabled. */
  readonly unavailable: boolean
  /** Pauses or resumes live updates. */
  setPaused: (paused: boolean) => void
  /** Records that live updates can't work. */
  markUnavailable: () => void
}

/**
 * The live updates switch, shared by the sidebar control and the hook that
 * applies changes. It is never persisted, so live updates are on at every launch.
 */
export const useLiveUpdatesStore = create<LiveUpdatesState>()((set) => ({
  paused: false,
  unavailable: false,
  setPaused: (paused) => {
    set({ paused })
  },
  markUnavailable: () => {
    set({ unavailable: true })
  }
}))
