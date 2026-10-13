/**
 * A figure's share of a total, as a whole percent.
 *
 * @param value - The figure.
 * @param total - The total it is part of.
 * @returns The rounded percent, or 0 when `total` is not above zero, so an empty overview never shows NaN.
 */
export function shareOfTotal(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}
