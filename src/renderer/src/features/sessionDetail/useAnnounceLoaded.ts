import { useRef, useState } from 'react'
import { useFocusOrAnnounce } from '@renderer/components/useFocusOrAnnounce'

/**
 * Tells whether to announce that a view finished loading, once. Only a load
 * that was on screen is announced: data already there when the view mounted
 * has nothing to announce. The announcement waits until `settled`, so what it
 * names is final, and a later change to either input doesn't repeat it.
 *
 * @param loaded - Whether the view's data has loaded.
 * @param settled - Whether everything the announcement names has settled.
 * @returns Whether to show the announcement. It turns `false` again after the hidden live copy's clear delay.
 */
export function useAnnounceLoaded(loaded: boolean, settled: boolean): boolean {
  const [sawLoading, setSawLoading] = useState(!loaded)
  const [ready, setReady] = useState(false)
  if (!loaded && !sawLoading) setSawLoading(true)
  if (loaded && settled && sawLoading && !ready) setReady(true)

  // The ref never holds an element, so the hook never moves focus and always announces.
  const noFocusTarget = useRef<HTMLElement>(null)
  return useFocusOrAnnounce(noFocusTarget, ready ? 'loaded' : '')
}
