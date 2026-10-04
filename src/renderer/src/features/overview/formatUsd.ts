import type { OverviewT } from './overviewT'

/**
 * Formats a US dollar amount to two decimals in the active language. A nonzero
 * amount that would round to zero reads as `<$0.01` so it isn't mistaken for free.
 *
 * @param usd - The amount.
 * @param t - The overview translate function, which supplies the currency format.
 * @returns For example `$12.34`.
 */
export function formatUsd(usd: number, t: OverviewT): string {
  return usd > 0 && usd < 0.01 ? t('usdUnderCent', { value: 0.01 }) : t('usd', { value: usd })
}
