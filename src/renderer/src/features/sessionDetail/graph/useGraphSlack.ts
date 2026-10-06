import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { controlsClearance } from './controlsClearance'
import { panSlack } from './graphSlack'
import type { Size } from './graphZoom'

const NO_SLACK: Size = { width: 0, height: 0 }

/**
 * Measures the empty scroll room to leave on every side of the graph, which
 * lets it be panned past its edges. The view's border box is measured, so a
 * scrollbar coming or going never changes the room. When the room changes the
 * scroll offsets shift by the change, so the graph keeps its place on screen
 * when the view resizes, and first lands with its top left at the view's top
 * left.
 *
 * @param viewportRef - The scrolling element the graph sits in.
 * @returns The room on each side of the graph, zero until the view has a size.
 */
export function useGraphSlack(viewportRef: RefObject<HTMLElement | null>): Size {
  const [slack, setSlack] = useState(NO_SLACK)
  // The room last applied, which the observer compares against and shifts the scroll by.
  const applied = useRef(NO_SLACK)

  // Layout effect, so the observer is watching before the first paint.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const observer = new ResizeObserver(() => {
      const next = panSlack(
        { width: viewport.offsetWidth, height: viewport.offsetHeight },
        controlsClearance(viewport)
      )
      const previous = applied.current
      if (next.width === previous.width && next.height === previous.height) return
      // Shrinking the content makes the browser clamp the offsets, so they are read before it does.
      const { scrollLeft, scrollTop } = viewport
      applied.current = next
      // Scrolling needs the resized content in place, so the update can't wait for the next frame.
      flushSync(() => {
        setSlack(next)
      })
      viewport.scrollLeft = scrollLeft + next.width - previous.width
      viewport.scrollTop = scrollTop + next.height - previous.height
    })
    observer.observe(viewport, { box: 'border-box' })
    return () => {
      observer.disconnect()
    }
  }, [viewportRef])

  return slack
}
