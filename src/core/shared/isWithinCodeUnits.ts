/**
 * True when `value` is a string of at most `cap` UTF-16 code units, so a
 * character outside the Basic Multilingual Plane counts as two.
 *
 * Every bound on an untrusted field is checked this way rather than with zod's
 * `.max()`, which counts code points: a code unit is what costs memory once a
 * value is retained in the scan cache.
 *
 * @param value - A candidate value, which need not be a string.
 * @param cap - The bound, in UTF-16 code units.
 * @returns Whether `value` is a string within `cap`.
 */
export function isWithinCodeUnits(value: unknown, cap: number): value is string {
  return typeof value === 'string' && value.length <= cap
}
