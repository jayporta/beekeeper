import type { Size } from './graphZoom'

/** The room to leave on one side of the graph along one axis. */
function slackAlong(view: number, graph: number): number {
  return view - Math.min(graph, view / 2)
}

/**
 * Finds the empty scroll room to leave on every side of the graph, so it can
 * be panned until only the smaller of its own size and half the view stays in
 * view. A graph bigger than half the view pans until its edge reaches the
 * middle, so a good part of it always stays in view. A smaller one stays whole
 * in view and can sit anywhere inside it.
 *
 * @param view - The view's size.
 * @param graph - The graph's size at the current scale.
 * @returns The room on each side.
 */
export function panSlack(view: Size, graph: Size): Size {
  return {
    width: slackAlong(view.width, graph.width),
    height: slackAlong(view.height, graph.height)
  }
}

/** Where a zoom happens, along one axis. */
interface ZoomAxis {
  /** The view's scroll offset before the zoom. */
  readonly scroll: number
  /** The zoom's center, in pixels from the view's start. */
  readonly anchor: number
  /** The empty room before the graph at the scale before the zoom, from {@link panSlack}. */
  readonly before: number
  /** The empty room before the graph at the scale after the zoom, from {@link panSlack}. */
  readonly after: number
  /** The factor the scale is multiplied by. */
  readonly ratio: number
}

/**
 * Finds the scroll offset, along one axis, that keeps the graph point under
 * the anchor in place when the scale is multiplied by `ratio`.
 *
 * @param options - The offset, anchor, slack before and after, and ratio of the zoom.
 * @returns The new scroll offset.
 */
export function scrollAfterZoom({ scroll, anchor, before, after, ratio }: ZoomAxis): number {
  return (scroll + anchor - before) * ratio + after - anchor
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
