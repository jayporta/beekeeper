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
}

/**
 * Pans a scrolling element by dragging its background with the primary
 * button. A press on a node starts nothing, so nodes are never dragged, and a
 * press on a zoom control never reaches the viewport.
 *
 * @param viewportRef - The scrolling element.
 * @returns The pointer handlers to put on it.
 */
export function useGraphPan(viewportRef: RefObject<HTMLElement | null>): GraphPan {
  const last = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown(event) {
      const onNode = event.target instanceof Element && event.target.closest('button') !== null
      if (event.button !== 0 || onNode) return
      last.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event) {
      const viewport = viewportRef.current
      if (last.current === null || viewport === null) return
      viewport.scrollLeft -= event.clientX - last.current.x
      viewport.scrollTop -= event.clientY - last.current.y
      last.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp() {
      last.current = null
    },
    onPointerCancel() {
      last.current = null
    }
  }
}
