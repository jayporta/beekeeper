import type { Size } from './graphZoom'

/** How much of the graph's box, in screen pixels, stays in view however far it is panned. */
export const PAN_KEEP = 64

/**
 * Finds the empty scroll room to leave on every side of the graph so it can be
 * panned until only {@link PAN_KEEP} pixels of it remain in view.
 *
 * @param view - The view's size.
 * @returns The room on each side: the view's size less the kept strip, never negative.
 */
export function panSlack(view: Size): Size {
  return {
    width: Math.max(0, view.width - PAN_KEEP),
    height: Math.max(0, view.height - PAN_KEEP)
  }
}

/** Where a zoom happens, along one axis. */
interface ZoomAxis {
  /** The view's scroll offset before the zoom. */
  readonly scroll: number
  /** The zoom's center, in pixels from the view's start. */
  readonly anchor: number
  /** The empty room before the graph, from {@link panSlack}. */
  readonly slack: number
  /** The factor the scale is multiplied by. */
  readonly ratio: number
}

/**
 * Finds the scroll offset, along one axis, that keeps the graph point under
 * the anchor in place when the scale is multiplied by `ratio`.
 *
 * @param options - The offset, anchor, slack and ratio of the zoom.
 * @returns The new scroll offset.
 */
export function scrollAfterZoom({ scroll, anchor, slack, ratio }: ZoomAxis): number {
  return (scroll + anchor - slack) * ratio + slack - anchor
}

/** A scaled graph and the room to center it in, along one axis. */
interface CenterAxis {
  /** The empty room before the graph, from {@link panSlack}. */
  readonly slack: number
  /** The scaled graph's length. */
  readonly content: number
  /** The length of the room to center it in. */
  readonly room: number
}

/**
 * Finds the scroll offset, along one axis, that centers a scaled graph in a room.
 *
 * @param options - The slack, the scaled graph's length and the room's length.
 * @returns The scroll offset. It is below the slack when the graph is shorter than the room.
 */
export function centeredScroll({ slack, content, room }: CenterAxis): number {
  return slack + (content - room) / 2
}
