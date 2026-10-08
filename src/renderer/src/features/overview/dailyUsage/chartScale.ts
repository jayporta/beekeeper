/** The y axis of the chart. */
export interface ChartScale {
  /** The value at the top of the axis: the largest tick, at or above the data. */
  readonly top: number
  /** The tick values from zero to {@link ChartScale.top}, evenly spaced. */
  readonly ticks: readonly number[]
}

/** The most ticks above zero. */
const MAX_TICKS = 5

const NICE_FACTORS = [1, 2, 5] as const

/**
 * Picks an axis for a data maximum: the smallest step of 1, 2, or 5 times a
 * power of ten, and at least one token, that reaches the maximum in at most
 * five steps.
 *
 * @param max - The largest value to show.
 * @returns The axis. Zero alone for a maximum that is not above zero, or not finite.
 */
export function chartScale(max: number): ChartScale {
  if (!Number.isFinite(max) || max <= 0) return { top: 0, ticks: [0] }

  let exponent = Math.floor(Math.log10(max))
  if (10 ** (exponent + 1) <= max) exponent += 1
  else if (10 ** exponent > max) exponent -= 1

  const candidates = [exponent - 1, exponent].flatMap((power) =>
    NICE_FACTORS.map((factor) => factor * 10 ** power)
  )
  const step =
    candidates.find((s) => s >= 1 && Math.ceil(max / s) <= MAX_TICKS) ?? 10 ** (exponent + 1)
  const count = Math.ceil(max / step)
  return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
}
