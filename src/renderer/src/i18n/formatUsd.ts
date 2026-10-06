/**
 * The part of a translate function {@link formatUsd} needs: the shared currency
 * strings, which it reads from the `common` namespace whichever namespace the
 * function is bound to.
 */
export type UsdT = (key: 'usd' | 'usdUnderCent', options: { ns: 'common'; value: number }) => string

/**
 * Formats a US dollar amount to two decimals in the active language. A nonzero
 * amount that would round to zero reads as `<$0.01` so it isn't mistaken for free.
 *
 * @param usd - The amount, or `null` when unknown.
 * @param t - Any translate function, which supplies the language.
 * @returns For example `$12.34`, or `null` when `usd` is `null`.
 */
export function formatUsd(usd: number, t: UsdT): string
export function formatUsd(usd: number | null, t: UsdT): string | null
export function formatUsd(usd: number | null, t: UsdT): string | null {
  if (usd === null) return null
  return usd > 0 && usd < 0.01
    ? t('usdUnderCent', { ns: 'common', value: 0.01 })
    : t('usd', { ns: 'common', value: usd })
}
