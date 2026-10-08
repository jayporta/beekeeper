import { tokenClasses } from './tokenClasses'
import type { TokenCounts } from './tokenCounts'

/**
 * Sums every billing class of one {@link TokenCounts}.
 *
 * @param counts - The token counts to total.
 * @returns The sum across all classes. A `NaN` or infinite class value
 * propagates, so a caller can reject a non-finite total.
 */
export function totalTokenCount(counts: TokenCounts): number {
  let total = 0
  for (const tokenClass of tokenClasses) total += counts[tokenClass]
  return total
}
