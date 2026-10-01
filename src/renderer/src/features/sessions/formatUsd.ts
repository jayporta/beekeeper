import type { SessionsT } from './sessionsT'

/**
 * Formats a US dollar amount to two decimals in the active language. A nonzero
 * amount that would round to zero reads as `<$0.01` so it isn't mistaken for free.
 *
 * @param usd - The amount, or `null` when unknown.
 * @param t - The sessions translate function, which supplies the currency format.
 * @returns For example `$12.34`, or `null` when `usd` is `null`.
 */
export function formatUsd(usd: number | null, t: SessionsT): string | null {
  if (usd === null) return null
  return usd > 0 && usd < 0.01 ? t('usdUnderCent', { value: 0.01 }) : t('usd', { value: usd })
}
