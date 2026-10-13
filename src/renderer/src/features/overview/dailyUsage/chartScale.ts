/** The y axis of the chart. */
export interface ChartScale {
  /** The value at the top of the axis: the largest tick, at or above the data. */
  readonly top: number
  /** The tick values from zero to {@link ChartScale.top}, evenly spaced. */
  readonly ticks: readonly number[]
}

/** The mantissas a top can take, in tenths: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, and 10. */
const NICE_TENTHS = [10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100] as const

/**
 * Picks an axis for a data maximum with three ticks: zero, a middle tick, and
 * the top. The top is the smallest of 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, or 10
 * times a power of ten that reaches the maximum and whose half is a whole
 * number of tokens, so the middle tick is never fractional.
 *
 * @param max - The largest value to show.
 * @returns The axis. Zero alone for a maximum that is not above zero, or not finite.
 */
export function chartScale(max: number): ChartScale {
  if (!Number.isFinite(max) || max <= 0) return { top: 0, ticks: [0] }

  const exponent = Math.floor(Math.log10(max))
  let top = Number.POSITIVE_INFINITY
  for (
    let power = Math.max(0, exponent - 1);
    power <= exponent + 1 && !Number.isFinite(top);
    power++
  ) {
    for (const tenths of NICE_TENTHS) {
      // Whole-number arithmetic from the power of ten up, so a top never picks up float error.
      const candidate = power === 0 ? tenths / 10 : tenths * 10 ** (power - 1)
      if (candidate >= max && Number.isInteger(candidate / 2)) {
        top = candidate
        break
      }
    }
  }
  if (!Number.isFinite(top)) top = 10 ** (exponent + 1)
  return { top, ticks: [0, top / 2, top] }
}
