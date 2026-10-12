/** The sidebar's narrowest width, in px. */
export const MIN_SIDEBAR_WIDTH = 200

/** The sidebar's widest width in a large window, in px. */
export const MAX_SIDEBAR_WIDTH = 560

/** The sidebar's width until the person resizes it, in px. */
export const DEFAULT_SIDEBAR_WIDTH = 260

/** What an arrow key changes the width by, in px. */
export const SIDEBAR_STEP = 16

/** What an arrow key with Shift changes the width by, in px. */
export const SIDEBAR_STEP_LARGE = 64

/** The share of the window the sidebar may take. */
const MAX_WINDOW_SHARE = 0.45

/** The room main keeps beside the sidebar, in px: the width where the layout stacks (40rem). */
const MAIN_MIN_WIDTH = 640

/**
 * The widest the sidebar may be in a window: a share of the window, never more
 * than the absolute maximum, and leaving main room beside it. The minimum wins
 * in a window too narrow for that.
 *
 * @param viewportWidth - The window's inner width in px.
 * @returns The maximum width in px.
 */
export function sidebarMaxWidth(viewportWidth: number): number {
  const limit = Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.round(MAX_WINDOW_SHARE * viewportWidth),
    viewportWidth - MAIN_MIN_WIDTH
  )
  return Math.max(MIN_SIDEBAR_WIDTH, limit)
}

/**
 * Keeps a sidebar width inside the range the window allows.
 *
 * @param px - The wanted width in px.
 * @param viewportWidth - The window's inner width in px.
 * @returns The width in whole px, between the minimum and {@link sidebarMaxWidth}.
 */
export function clampSidebarWidth(px: number, viewportWidth: number): number {
  return Math.min(sidebarMaxWidth(viewportWidth), Math.max(MIN_SIDEBAR_WIDTH, Math.round(px)))
}
