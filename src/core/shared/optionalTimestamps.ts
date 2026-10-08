/** Lifts `pick` to optional timestamps: a `null` gives way to the other value. */
function ignoringNull(
  pick: (a: number, b: number) => number
): (a: number | null, b: number | null) => number | null {
  return (a, b) => (a === null ? b : b === null ? a : pick(a, b))
}

/**
 * The earlier of two optional timestamps, in epoch milliseconds. A `null`
 * gives way to the other value.
 *
 * @param a - A timestamp, or `null` when there is none.
 * @param b - Another timestamp, or `null` when there is none.
 * @returns The smaller timestamp, or `null` when both are `null`.
 */
export const earlierTimestamp = ignoringNull(Math.min)

/**
 * The later of two optional timestamps, in epoch milliseconds. A `null`
 * gives way to the other value.
 *
 * @param a - A timestamp, or `null` when there is none.
 * @param b - Another timestamp, or `null` when there is none.
 * @returns The larger timestamp, or `null` when both are `null`.
 */
export const laterTimestamp = ignoringNull(Math.max)
