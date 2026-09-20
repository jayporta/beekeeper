/**
 * Compares two strings by UTF-16 code unit, the same ordering `<` and `>`
 * use on strings. Deterministic and independent of locale, unlike
 * `String.prototype.localeCompare`.
 *
 * @param a - The first string.
 * @param b - The second string.
 * @returns A negative number when `a` sorts before `b`, a positive number
 * when it sorts after `b`, and `0` when they are equal.
 */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
