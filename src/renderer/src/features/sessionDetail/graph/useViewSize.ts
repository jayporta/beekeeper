import { useLayoutEffect, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { Size } from './graphZoom'

const NO_SIZE: Size = { width: 0, height: 0 }

/**
 * Measures an element's border box, so a scrollbar coming or going never
 * changes it. A change is committed before the browser paints, so the room
 * laid out from it is in place when the caller adjusts the scroll offsets.
 *
 * @param viewportRef - The element to measure.
 * @returns Its size, zero until it has been measured.
 */
export function useViewSize(viewportRef: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState(NO_SIZE)

  // Layout effect, so the observer is watching before the first paint.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const observer = new ResizeObserver(() => {
      const next = { width: viewport.offsetWidth, height: viewport.offsetHeight }
      flushSync(() => {
        setSize((previous) =>
          previous.width === next.width && previous.height === next.height ? previous : next
        )
      })
    })
    observer.observe(viewport, { box: 'border-box' })
    return () => {
      observer.disconnect()
    }
  }, [viewportRef])

  return size
}
