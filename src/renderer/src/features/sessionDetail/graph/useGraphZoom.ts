import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { controlsClearance } from './controlsClearance'
import { centeredScroll, scrollAfterZoom } from './graphSlack'
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
  /** Scales the whole graph to fit the room above the zoom controls, never magnifying it, and centers it there. Does nothing while the viewport has no size. */
  readonly fit: () => void
}

/** What the zoom needs to know about the graph and the room around it. */
interface GraphZoomOptions {
  /** The graph's size at scale 1. */
  readonly content: Size
  /** The empty scroll room on each side of the graph, from {@link useGraphSlack}. */
  readonly slack: Size
}

/**
 * The size Fit aims for: the viewport's client size less the space at the
 * bottom that the zoom controls cover (its bottom scroll padding). The
 * viewport's height doesn't follow the graph and the room around the graph
 * keeps both scrollbars present at every scale, so the client size is stable
 * as the graph is scaled.
 */
function fitTarget(viewport: HTMLElement): Size {
  return {
    width: viewport.clientWidth,
    height: viewport.clientHeight - controlsClearance(viewport)
  }
}

/**
 * Holds the graph's scale and changes it by the zoom buttons, by Fit, and by
 * Ctrl or Cmd with the wheel. The viewport scrolls natively, so a change keeps
 * the point under the pointer (or the viewport's center) where it was by
 * scrolling to match. A plain wheel turn or trackpad scroll pans the view
 * natively, and only Ctrl or Cmd with the wheel is taken.
 *
 * @param viewportRef - The scrolling element the graph sits in.
 * @param options - The graph's size and the room around it.
 * @returns The scale and the actions that change it.
 */
export function useGraphZoom(
  viewportRef: RefObject<HTMLElement | null>,
  { content, slack }: GraphZoomOptions
): GraphZoom {
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
      viewport.scrollLeft = scrollAfterZoom({
        scroll: scrollLeft,
        anchor: anchor.x,
        slack: slack.width,
        ratio
      })
      viewport.scrollTop = scrollAfterZoom({
        scroll: scrollTop,
        anchor: anchor.y,
        slack: slack.height,
        ratio
      })
    },
    [viewportRef, slack, applyScale]
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
    const target = fitTarget(viewport)
    const next = fitScale(content, target)
    if (next === null) return
    applyScale(next)
    viewport.scrollLeft = centeredScroll({
      slack: slack.width,
      content: content.width * next,
      room: target.width
    })
    viewport.scrollTop = centeredScroll({
      slack: slack.height,
      content: content.height * next,
      room: target.height
    })
  }, [viewportRef, content, slack, applyScale])

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
