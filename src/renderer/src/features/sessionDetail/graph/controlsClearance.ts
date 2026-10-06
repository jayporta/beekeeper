/**
 * Reads the room at the bottom of a graph view that the zoom controls cover:
 * its bottom scroll padding.
 *
 * @param viewport - The scrolling element the graph sits in.
 * @returns The room in pixels, or zero when the padding isn't a length.
 */
export function controlsClearance(viewport: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(viewport).scrollPaddingBottom) || 0
}
