import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { centeredScroll, panSlack, scrollAfterZoom } from './graphSlack'
import { fitScale, scaleAfterWheel, stepScale, type Size } from './graphZoom'
import { useSeenScroll } from './useSeenScroll'
import { useViewSize } from './useViewSize'

/** A point inside the viewport, in pixels from its top left corner. */
interface Point {
  readonly x: number
  readonly y: number
}

/** The graph's zoom. */
interface GraphZoom {
  /** The current scale. */
  readonly scale: number
  /** The empty scroll room on each side of the graph at the current scale. */
  readonly slack: Size
  /** Shrinks by one step around the viewport's center. */
  readonly zoomOut: () => void
  /** Magnifies by one step around the viewport's center. */
  readonly zoomIn: () => void
  /** Scales the whole graph to fit the room above the zoom controls, never magnifying it, and centers it there. Does nothing while the viewport has no size. */
  readonly fit: () => void
}

/**
 * The size Fit aims for: the viewport's client size less the space at the
 * bottom that the zoom controls cover (its bottom scroll padding). The
 * viewport's height doesn't follow the graph and the room around the graph
 * keeps both scrollbars present at every scale, so the client size is stable
 * as the graph is scaled.
 */
function fitTarget(viewport: HTMLElement): Size {
  const covered = Number.parseFloat(getComputedStyle(viewport).scrollPaddingBottom) || 0
  return { width: viewport.clientWidth, height: viewport.clientHeight - covered }
}

/**
 * Holds the graph's scale and the empty scroll room around the graph, and
 * changes the scale by the zoom buttons, by Fit, and by Ctrl or Cmd with the
 * wheel. The room lets the graph be panned past its edges, and depends on the
 * viewport's size and the scaled graph's. The viewport scrolls natively, so a
 * change of scale keeps the point under the pointer (or the viewport's center)
 * where it was by scrolling to match, and a change of the viewport's or the
 * graph's size keeps the graph where it is on screen. The graph first lands with
 * its top left at the viewport's top left. A plain wheel turn or trackpad scroll
 * pans the view natively, and only Ctrl or Cmd with the wheel is taken.
 *
 * @param viewportRef - The scrolling element the graph sits in.
 * @param content - The graph's size at scale 1.
 * @returns The scale, the room around the graph, and the actions that change the scale.
 */
export function useGraphZoom(viewportRef: RefObject<HTMLElement | null>, content: Size): GraphZoom {
  const { width: contentWidth, height: contentHeight } = content
  const [scale, setScale] = useState(1)
  // The scale the latest change set, for handlers that outlive a render, so the wheel listener attaches once.
  const scaleRef = useRef(scale)
  const view = useViewSize(viewportRef)
  const seenScroll = useSeenScroll(viewportRef)

  const slackAt = useCallback(
    (at: number): Size => panSlack(view, { width: contentWidth * at, height: contentHeight * at }),
    [view, contentWidth, contentHeight]
  )
  const slack = slackAt(scale)
  // The room the offsets last accounted for.
  const accountedFor = useRef(slack)

  // Keeps the graph where it is on screen when the room before it changes, other than by a zoom. The
  // browser clamps the live offsets while laying the change out, so the ones last seen are shifted.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const previous = accountedFor.current
    accountedFor.current = { width: slack.width, height: slack.height }
    if (viewport === null || (previous.width === slack.width && previous.height === slack.height)) {
      return
    }
    const { left, top } = seenScroll.current
    viewport.scrollLeft = left + slack.width - previous.width
    viewport.scrollTop = top + slack.height - previous.height
  }, [viewportRef, seenScroll, slack.width, slack.height])

  // Applies a scale, whose room the caller sets the offsets for, so the shift above leaves it be.
  const applyScale = useCallback(
    (next: number) => {
      scaleRef.current = next
      accountedFor.current = slackAt(next)
      // Scrolling needs the resized content in place, so the update can't wait for the next frame.
      flushSync(() => {
        setScale(next)
      })
    },
    [slackAt]
  )

  const zoomAround = useCallback(
    (next: number, anchor: Point) => {
      const viewport = viewportRef.current
      const current = scaleRef.current
      if (viewport === null || next === current) return
      const ratio = next / current
      const before = slackAt(current)
      const after = slackAt(next)
      // Shrinking the content makes the browser clamp the offsets, so they are read before it does.
      const { scrollLeft, scrollTop } = viewport
      applyScale(next)
      viewport.scrollLeft = scrollAfterZoom({
        scroll: scrollLeft,
        anchor: anchor.x,
        before: before.width,
        after: after.width,
        ratio
      })
      viewport.scrollTop = scrollAfterZoom({
        scroll: scrollTop,
        anchor: anchor.y,
        before: before.height,
        after: after.height,
        ratio
      })
    },
    [viewportRef, slackAt, applyScale]
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
    const next = fitScale({ width: contentWidth, height: contentHeight }, target)
    if (next === null) return
    const after = slackAt(next)
    applyScale(next)
    viewport.scrollLeft = centeredScroll({
      slack: after.width,
      content: contentWidth * next,
      room: target.width
    })
    viewport.scrollTop = centeredScroll({
      slack: after.height,
      content: contentHeight * next,
      room: target.height
    })
  }, [viewportRef, contentWidth, contentHeight, slackAt, applyScale])

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
    slack,
    zoomOut: useCallback(() => {
      zoomBy('out')
    }, [zoomBy]),
    zoomIn: useCallback(() => {
      zoomBy('in')
    }, [zoomBy]),
    fit
  }
}
