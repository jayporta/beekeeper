import { useRef, type PointerEvent, type RefObject } from 'react'

/** The pointer handlers that make a scrolling element pannable by dragging its background. */
interface GraphPan {
  /** Starts a drag on the background. */
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  /** Scrolls by how far the pointer moved while dragging. */
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  /** Ends the drag. */
  readonly onPointerUp: () => void
  /** Ends the drag when the browser takes the pointer. */
  readonly onPointerCancel: () => void
  /** Ends the drag when the element loses the pointer capture the drag took. */
  readonly onLostPointerCapture: () => void
}

/** Whether a press landed on the scrollbar of the element the handler is on, which lies outside its client area. */
function onScrollbar(event: PointerEvent<HTMLElement>): boolean {
  const { currentTarget, nativeEvent } = event
  // The offsets are relative to the pressed element, so they only place a press on this one.
  if (event.target !== currentTarget) return false
  return (
    nativeEvent.offsetX >= currentTarget.clientWidth ||
    nativeEvent.offsetY >= currentTarget.clientHeight
  )
}

/**
 * Pans a scrolling element by dragging its background with the primary
 * button. A press on a node starts nothing, so nodes are never dragged, a
 * press on a zoom control never reaches the viewport, and a press on the
 * element's own scrollbar is left to the scrollbar. The drag ends on the
 * release, and also on any move without the primary button held, so a release
 * that never reaches the element can't leave the view following the pointer.
 *
 * @param viewportRef - The scrolling element.
 * @returns The pointer handlers to put on it.
 */
export function useGraphPan(viewportRef: RefObject<HTMLElement | null>): GraphPan {
  const last = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown(event) {
      const onNode = event.target instanceof Element && event.target.closest('button') !== null
      if (event.button !== 0 || onNode || onScrollbar(event)) return
      last.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event) {
      const viewport = viewportRef.current
      if (last.current === null || viewport === null) return
      // The bit for the primary button. Without it the button was released, whether or not the release arrived.
      if ((event.buttons & 1) === 0) {
        last.current = null
        return
      }
      viewport.scrollLeft -= event.clientX - last.current.x
      viewport.scrollTop -= event.clientY - last.current.y
      last.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp() {
      last.current = null
    },
    onPointerCancel() {
      last.current = null
    },
    onLostPointerCapture() {
      last.current = null
    }
  }
}
