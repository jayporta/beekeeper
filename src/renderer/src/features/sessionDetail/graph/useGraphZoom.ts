import { useCallback, useEffect, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { fitScale, scaleAfterWheel, stepScale, type Size } from './graphZoom'

/** A point inside the viewport, in pixels from its top left corner. */
interface Point {
  readonly x: number
  readonly y: number
}

/** The graph's zoom. */
interface GraphZoom {
  /** The current scale. */
  readonly scale: number
  /** Shrinks by one step around the viewport's center. */
  readonly zoomOut: () => void
  /** Magnifies by one step around the viewport's center. */
  readonly zoomIn: () => void
  /** Scales the whole graph to fit the viewport, and scrolls to its top left. Does nothing while the viewport has no size. */
  readonly fit: () => void
}

/**
 * Holds the graph's scale and changes it by the zoom buttons, by Fit, and by
 * Ctrl or Cmd with the wheel. The viewport scrolls natively, so a change keeps
 * the point under the pointer (or the viewport's center) where it was by
 * scrolling to match. A plain wheel turn is left alone, so it scrolls the
 * page as usual.
 *
 * @param viewportRef - The scrolling element the graph sits in.
 * @param content - The graph's size at scale 1.
 * @returns The scale and the actions that change it.
 */
export function useGraphZoom(viewportRef: RefObject<HTMLElement | null>, content: Size): GraphZoom {
  const [scale, setScale] = useState(1)

  const zoomAround = useCallback(
    (next: number, anchor: Point) => {
      const viewport = viewportRef.current
      if (viewport === null || next === scale) return
      const ratio = next / scale
      // Scrolling needs the resized content in place, so the update can't wait for the next frame.
      flushSync(() => {
        setScale(next)
      })
      viewport.scrollLeft = (viewport.scrollLeft + anchor.x) * ratio - anchor.x
      viewport.scrollTop = (viewport.scrollTop + anchor.y) * ratio - anchor.y
    },
    [viewportRef, scale]
  )

  const zoomBy = useCallback(
    (direction: 'in' | 'out') => {
      const viewport = viewportRef.current
      if (viewport === null) return
      zoomAround(stepScale(scale, direction), {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2
      })
    },
    [viewportRef, scale, zoomAround]
  )

  const fit = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const next = fitScale(content, { width: viewport.clientWidth, height: viewport.clientHeight })
    if (next === null) return
    flushSync(() => {
      setScale(next)
    })
    viewport.scrollLeft = 0
    viewport.scrollTop = 0
  }, [viewportRef, content])

  // A wheel listener has to be non-passive to cancel the browser's own page zoom.
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      zoomAround(scaleAfterWheel(scale, event.deltaY), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      })
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [viewportRef, scale, zoomAround])

  return {
    scale,
    zoomOut: useCallback(() => {
      zoomBy('out')
    }, [zoomBy]),
    zoomIn: useCallback(() => {
      zoomBy('in')
    }, [zoomBy]),
    fit
  }
}
