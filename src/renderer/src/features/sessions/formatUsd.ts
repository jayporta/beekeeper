const FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * Formats a US dollar amount to two decimals. A nonzero amount that would
 * round to zero reads as `<$0.01` so it isn't mistaken for free.
 *
 * @param usd - The amount, or `null` when unknown.
 * @returns For example `$12.34`, or `null` when `usd` is `null`.
 */
export function formatUsd(usd: number | null): string | null {
  if (usd === null) return null
  return usd > 0 && usd < 0.01 ? '<$0.01' : FORMAT.format(usd)
}
