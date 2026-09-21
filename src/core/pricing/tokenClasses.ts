/**
 * The billing classes a token can fall into. Single source of truth for
 * anything that iterates over or types a per-class breakdown, including
 * {@link TokenCounts} and the price table's per-speed price entries.
 */
export const tokenClasses = [
  /** Tokens billed at the standard input rate. */
  'input',
  /** Tokens the model generated, billed at the output rate. */
  'output',
  /** Tokens read from the prompt cache. */
  'cacheRead',
  /** Tokens written to the prompt cache with a 5-minute retention window. */
  'cacheWrite5m',
  /** Tokens written to the prompt cache with a 1-hour retention window. */
  'cacheWrite1h'
] as const

/** One of the billing classes in {@link tokenClasses}. */
export type TokenClass = (typeof tokenClasses)[number]
