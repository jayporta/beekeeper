import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  const overlay = navigator.windowControlsOverlay
  overlay?.addEventListener('geometrychange', onChange)
  return () => {
    overlay?.removeEventListener('geometrychange', onChange)
  }
}

function isVisible(): boolean {
  return navigator.windowControlsOverlay?.visible ?? false
}

/**
 * Whether the window's controls (the macOS traffic lights) float over the page
 * through the Window Controls Overlay. It is `false` where the window keeps its
 * native frame.
 *
 * @returns `true` while the overlay is visible.
 */
export function useWindowControlsOverlay(): boolean {
  return useSyncExternalStore(subscribe, isVisible)
}
