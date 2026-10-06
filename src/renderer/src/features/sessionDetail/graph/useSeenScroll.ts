import { useEffect, useRef, type RefObject } from 'react'

/** A scrolling element's offsets. */
interface ScrollOffsets {
  /** The horizontal offset. */
  readonly left: number
  /** The vertical offset. */
  readonly top: number
}

/**
 * Tracks the offsets of a scrolling element as its `scroll` events last saw
 * them. When the element's content or size changes, the browser clamps the
 * live offsets while laying it out, before a `ResizeObserver` reports, and
 * announces the clamp only in a later frame. The offsets seen here are the ones
 * from before.
 *
 * @param viewportRef - The scrolling element.
 * @returns A ref to the offsets the last `scroll` event saw, zero until one has.
 */
export function useSeenScroll(
  viewportRef: RefObject<HTMLElement | null>
): RefObject<ScrollOffsets> {
  const seen = useRef<ScrollOffsets>({ left: 0, top: 0 })

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    seen.current = { left: viewport.scrollLeft, top: viewport.scrollTop }
    const onScroll = (): void => {
      seen.current = { left: viewport.scrollLeft, top: viewport.scrollTop }
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [viewportRef])

  return seen
}
