/** The smallest scale: a quarter size. */
export const MIN_SCALE = 0.25

/** The largest scale: double size. */
export const MAX_SCALE = 2

/** The factor one press of a zoom button scales by. */
export const ZOOM_STEP = 1.25

/** How strongly a turn of the wheel scales: the scale is multiplied by `exp(-deltaY * this)`. */
const WHEEL_SENSITIVITY = 0.01

/** A width and a height, in pixels. */
export interface Size {
  /** The width. */
  readonly width: number
  /** The height. */
  readonly height: number
}

/**
 * Holds a scale within {@link MIN_SCALE} and {@link MAX_SCALE}.
 *
 * @param scale - The wanted scale.
 * @returns The scale, raised or lowered to the nearest limit when outside them.
 */
export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * Scales by one step of a zoom button.
 *
 * @param scale - The current scale.
 * @param direction - `in` to magnify, `out` to shrink.
 * @returns The new scale, held within the limits.
 */
export function stepScale(scale: number, direction: 'in' | 'out'): number {
  return clampScale(direction === 'in' ? scale * ZOOM_STEP : scale / ZOOM_STEP)
}

/**
 * Scales by a turn of the wheel: up (negative `deltaY`) magnifies, down shrinks,
 * and a bigger turn scales more.
 *
 * @param scale - The current scale.
 * @param deltaY - The wheel event's vertical delta.
 * @returns The new scale, held within the limits.
 */
export function scaleAfterWheel(scale: number, deltaY: number): number {
  return clampScale(scale * Math.exp(-deltaY * WHEEL_SENSITIVITY))
}

/**
 * Finds the scale that fits a whole graph into a view: the tighter of the
 * width and height ratios. It never magnifies a graph that already fits, and
 * never goes below {@link MIN_SCALE}.
 *
 * @param content - The graph's size at scale 1.
 * @param viewport - The view's size.
 * @returns The scale, or `null` when the view has no size to fit into.
 */
export function fitScale(content: Size, viewport: Size): number | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null
  return clampScale(Math.min(1, viewport.width / content.width, viewport.height / content.height))
}
