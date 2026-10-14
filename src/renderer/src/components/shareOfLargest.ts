/**
 * How much of the largest figure a figure is, for a share bar.
 *
 * @param value - The figure.
 * @param largest - The largest figure on screen.
 * @returns A fraction from 0 to 1, or 0 when `largest` is not above zero, so an empty overview has no bar.
 */
export function shareOfLargest(value: number, largest: number): number {
  return largest > 0 ? Math.min(1, value / largest) : 0
}
