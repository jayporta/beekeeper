/** The root of every reported-cost query, so all of them can be dropped at once. */
export const REPORTED_COST_QUERY_ROOT = ['reportedCost'] as const

/**
 * The query key of one session's reported cost. It is not one of the persisted
 * roots.
 *
 * @param sessionId - The session the figures belong to.
 * @returns The key, under {@link REPORTED_COST_QUERY_ROOT}.
 */
export function reportedCostQueryKey(sessionId: string): readonly ['reportedCost', string] {
  return [...REPORTED_COST_QUERY_ROOT, sessionId]
}
