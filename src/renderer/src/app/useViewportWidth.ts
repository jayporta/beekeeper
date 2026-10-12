import { useSyncExternalStore } from 'react'

/** Calls `onChange` when the window is resized, and returns a function that stops listening. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
  }
}

/** The window's current inner width in px. */
function getSnapshot(): number {
  return window.innerWidth
}

/**
 * The window's inner width, kept current as the window is resized.
 *
 * @returns The width in px.
 */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, getSnapshot)
}
