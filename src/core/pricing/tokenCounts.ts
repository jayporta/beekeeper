import type { TokenClass } from './tokenClasses'

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
