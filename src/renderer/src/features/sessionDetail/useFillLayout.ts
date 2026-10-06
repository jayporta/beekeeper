import { useSyncExternalStore } from 'react'

/**
 * The window sizes at which the session detail view fills the window and its
 * panes scroll on their own. The CSS modules repeat it as a literal, because
 * custom properties can't be used in a media query.
 */
export const FILL_LAYOUT_QUERY = '(width > 60rem) and (min-height: 30rem)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(FILL_LAYOUT_QUERY)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function matches(): boolean {
  return window.matchMedia(FILL_LAYOUT_QUERY).matches
}

/**
 * Whether the window is in the fill layout, kept current as it is resized or
 * zoomed.
 *
 * @returns `true` while {@link FILL_LAYOUT_QUERY} matches.
 */
export function useFillLayout(): boolean {
  return useSyncExternalStore(subscribe, matches)
}
