import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
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
  /** Scales the whole graph to fit the viewport at its tallest, and scrolls to its top left. Does nothing while the viewport has no size. */
  readonly fit: () => void
}

/**
 * The size Fit aims for. The viewport grows with the scaled graph up to its
 * maximum height, so its own height says nothing stable about the room there
 * is: Fit aims at that maximum instead. A viewport with no maximum fills its
 * pane, so its current height is the room. Either way the space below the graph
 * that the zoom controls cover (the viewport's bottom scroll padding) is left
 * out. The width and a filled pane's height are the ones without a scrollbar,
 * which comes and goes as the graph is scaled: the border-box size less the
 * borders, not `clientWidth` or `clientHeight`.
 */
function fitTarget(viewport: HTMLElement): Size {
  const style = getComputedStyle(viewport)
  const maxHeight = Number.parseFloat(style.maxHeight)
  const covered = Number.parseFloat(style.scrollPaddingBottom) || 0
  const borderWidths =
    (Number.parseFloat(style.borderLeftWidth) || 0) +
    (Number.parseFloat(style.borderRightWidth) || 0)
  const borderHeights =
    (Number.parseFloat(style.borderTopWidth) || 0) +
    (Number.parseFloat(style.borderBottomWidth) || 0)
  return {
    width: viewport.offsetWidth - borderWidths,
    height:
      (Number.isFinite(maxHeight) ? maxHeight : viewport.offsetHeight - borderHeights) - covered
  }
}

/**
 * Holds the graph's scale and changes it by the zoom buttons, by Fit, and by
 * Ctrl or Cmd with the wheel. The viewport scrolls natively, so a change keeps
 * the point under the pointer (or the viewport's center) where it was by
 * scrolling to match. A plain wheel turn is left alone, so it scrolls the
 * enclosing pane or page as usual.
 *
 * @param viewportRef - The scrolling element the graph sits in.
 * @param content - The graph's size at scale 1.
 * @returns The scale and the actions that change it.
 */
export function useGraphZoom(viewportRef: RefObject<HTMLElement | null>, content: Size): GraphZoom {
  const [scale, setScale] = useState(1)
  // The scale the latest change set, for handlers that outlive a render, so the wheel listener attaches once.
  const scaleRef = useRef(scale)

  const applyScale = useCallback((next: number) => {
    scaleRef.current = next
    // Scrolling needs the resized content in place, so the update can't wait for the next frame.
    flushSync(() => {
      setScale(next)
    })
  }, [])

  const zoomAround = useCallback(
    (next: number, anchor: Point) => {
      const viewport = viewportRef.current
      const current = scaleRef.current
      if (viewport === null || next === current) return
      const ratio = next / current
      // Shrinking the content makes the browser clamp the offsets, so they are read before it does.
      const { scrollLeft, scrollTop } = viewport
      applyScale(next)
      viewport.scrollLeft = (scrollLeft + anchor.x) * ratio - anchor.x
      viewport.scrollTop = (scrollTop + anchor.y) * ratio - anchor.y
    },
    [viewportRef, applyScale]
  )

  const zoomBy = useCallback(
    (direction: 'in' | 'out') => {
      const viewport = viewportRef.current
      if (viewport === null) return
      zoomAround(stepScale(scaleRef.current, direction), {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2
      })
    },
    [viewportRef, zoomAround]
  )

  const fit = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const next = fitScale(content, fitTarget(viewport))
    if (next === null) return
    applyScale(next)
    viewport.scrollLeft = 0
    viewport.scrollTop = 0
  }, [viewportRef, content, applyScale])

  // A wheel listener has to be non-passive to cancel the browser's own page zoom.
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      zoomAround(scaleAfterWheel(scaleRef.current, event.deltaY), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      })
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [viewportRef, zoomAround])

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
