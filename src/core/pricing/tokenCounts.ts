import { tokenClasses, type TokenClass } from './tokenClasses'

/**
 * Token counts for one usage snapshot or aggregation, keyed by billing
 * class. See {@link tokenClasses} for what each class means.
 */
export type TokenCounts = Readonly<Record<TokenClass, number>>

/** A {@link TokenCounts} with every class at zero. */
export const emptyTokenCounts: TokenCounts = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite5m: 0,
  cacheWrite1h: 0
}

/**
 * Combines a pair of {@link TokenCounts} field-by-field. The single place
 * that knows how to walk every billing class for a combination (sum, max,
 * or otherwise), so a class added to {@link tokenClasses} needs handling
 * only here.
 *
 * @param pair - The two token counts to combine.
 * @param combine - Called once per billing class, with that class's value
 * from each of `pair`.
 * @returns A new {@link TokenCounts} holding each class's combined value.
 */
export function combineTokenCounts(
  pair: readonly [TokenCounts, TokenCounts],
  combine: (a: number, b: number) => number
): TokenCounts {
  const [a, b] = pair
  const result: Record<TokenClass, number> = { ...emptyTokenCounts }

  for (const tokenClass of tokenClasses) {
    result[tokenClass] = combine(a[tokenClass], b[tokenClass])
  }

  return result
}
