import { useEffect, useRef, type RefObject } from 'react'
import type { Size } from './graphZoom'

/** A scrolling element's offsets. */
interface ScrollOffsets {
  /** The horizontal offset. */
  readonly left: number
  /** The vertical offset. */
  readonly top: number
}

/**
 * Tracks the offsets of a scrolling element as its `scroll` events last saw
 * them. When the element's size changes, the browser clamps the live offsets
 * while laying it out, before a `ResizeObserver` reports, and its `scroll`
 * event for the clamp can arrive before the report too. Events are ignored
 * while the element's border box differs from the size last measured, since
 * their offsets are the browser's clamp and not a pan. The offsets seen here
 * are the ones from before.
 *
 * @param viewportRef - The scrolling element.
 * @param measured - A ref to the element's border box as last measured.
 * @returns A ref to the offsets the last counted `scroll` event saw, zero until one has.
 */
export function useSeenScroll(
  viewportRef: RefObject<HTMLElement | null>,
  measured: RefObject<Size>
): RefObject<ScrollOffsets> {
  const seen = useRef<ScrollOffsets>({ left: 0, top: 0 })

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    seen.current = { left: viewport.scrollLeft, top: viewport.scrollTop }
    const onScroll = (): void => {
      const { width, height } = measured.current
      if (viewport.offsetWidth !== width || viewport.offsetHeight !== height) return
      seen.current = { left: viewport.scrollLeft, top: viewport.scrollTop }
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [viewportRef, measured])

  return seen
}
