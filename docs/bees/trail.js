/** Distance in pixels between the dots of a trail. */
const TRAIL_SPACING = 7
/** Most dots a trail keeps before dropping the oldest. */
const TRAIL_LENGTH = 70

/** Where a bee has been, as evenly spaced dots with a bounded count. */
export class Trail {
  /**
   * @param {{ x: number, y: number }} start - The first dot.
   */
  constructor({ x, y }) {
    /** Dots, oldest first. @type {{ x: number, y: number }[]} */
    this.points = [{ x, y }]
  }

  /**
   * Adds a dot at the bee's position once it has moved far enough from the last one.
   * @param {{ x: number, y: number }} position - Where the bee is now.
   */
  record({ x, y }) {
    const last = this.points.at(-1)
    if (last && Math.hypot(x - last.x, y - last.y) < TRAIL_SPACING) return
    this.points.push({ x, y })
    if (this.points.length > TRAIL_LENGTH) this.points.shift()
  }
}
