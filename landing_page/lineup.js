/** Horizontal distance between lined-up bees, wider than a card. */
const SLOT_WIDTH = 164
/** Vertical distance between rows of lined-up bees, taller than a bee, its card, and its button. */
const ROW_HEIGHT = 130
/** Distance from the top of the page to the centers of the first row of bees. */
const FIRST_ROW = 44
/** Gap between a lined-up bee's center and the top of its card. */
const CARD_OFFSET = 28
/** Height of a card, the gap under it, and its Release button, with a little room to spare. */
const CARD_STACK_HEIGHT = 82
/** Distance from a lined-up bee's center to the bottom of the Release button under its card. */
const SLOT_DEPTH = CARD_OFFSET + CARD_STACK_HEIGHT
/** Space kept clear at each side of the page. */
const GUTTER = 16

function slotsPerRow(width) {
  return Math.max(1, Math.floor((width - GUTTER * 2) / SLOT_WIDTH))
}

/**
 * Counts how many bees fit in the lineup without any card or button running off the page.
 * @param {{ width: number, height: number }} bounds - The page size in CSS pixels.
 * @returns {number} The number of slots, or 0 when not even one row fits.
 */
export function lineupCapacity({ width, height }) {
  const rows = Math.max(0, Math.floor((height - FIRST_ROW - SLOT_DEPTH) / ROW_HEIGHT) + 1)
  return rows * slotsPerRow(width)
}

/**
 * Finds where a lined-up bee sits: in rows along the top of the page, filled left to right and
 * centered as a block.
 * @param {number} index - The bee's place in the lineup, starting at 0.
 * @param {{ width: number }} bounds - The page size in CSS pixels.
 * @returns {{ x: number, y: number }} The center of the bee's slot, in CSS pixels.
 */
export function slotCenter(index, { width }) {
  const perRow = slotsPerRow(width)
  const left = (width - perRow * SLOT_WIDTH) / 2
  return {
    x: left + ((index % perRow) + 0.5) * SLOT_WIDTH,
    y: FIRST_ROW + Math.floor(index / perRow) * ROW_HEIGHT
  }
}

/**
 * Finds where the card under a lined-up bee goes.
 * @param {number} index - The bee's place in the lineup, starting at 0.
 * @param {{ width: number }} bounds - The page size in CSS pixels.
 * @returns {{ x: number, y: number }} The middle of the card's top edge, in CSS pixels.
 */
export function cardTop(index, bounds) {
  const center = slotCenter(index, bounds)
  return { x: center.x, y: center.y + CARD_OFFSET }
}
