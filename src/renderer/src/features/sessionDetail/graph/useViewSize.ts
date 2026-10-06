import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { Size } from './graphZoom'

const NO_SIZE: Size = { width: 0, height: 0 }

/** An element's measured size. */
interface ViewSize {
  /** The size, zero until the element has been measured. */
  readonly size: Size
  /** The size last measured, which is updated the moment the observer reports and so can be ahead of `size`. */
  readonly measured: RefObject<Size>
}

/**
 * Measures the area an element shows: its client box, which leaves out the
 * room its scrollbars take. The element's content box is observed, which
 * changes whenever the client box does. A change is committed before the browser paints, so the room
 * laid out from it is in place when the caller adjusts the scroll offsets.
 *
 * @param viewportRef - The element to measure.
 * @returns Its client size, and a ref to the size last measured.
 */
export function useViewSize(viewportRef: RefObject<HTMLElement | null>): ViewSize {
  const [size, setSize] = useState(NO_SIZE)
  const measured = useRef(NO_SIZE)

  // Layout effect, so the observer is watching before the first paint.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const observer = new ResizeObserver(() => {
      const next = { width: viewport.clientWidth, height: viewport.clientHeight }
      measured.current = next
      flushSync(() => {
        setSize((previous) =>
          previous.width === next.width && previous.height === next.height ? previous : next
        )
      })
    })
    observer.observe(viewport)
    return () => {
      observer.disconnect()
    }
  }, [viewportRef])

  return { size, measured }
}
