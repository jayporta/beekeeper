import type { QueryClient } from '@tanstack/react-query'
import { createLimiter, type Limiter } from '../totalsLimiter'

/**
 * How many folders' daily usage the renderer asks main for at once. Main runs
 * one daily scan at a time, so a second request would only wait there; asking
 * for one at a time means a request still waiting when nothing shows the chart
 * any more never reaches main. It is a separate limiter from the totals', so
 * the chart's requests never take the totals' slots.
 */
export const MAX_DAILY_USAGE_IN_FLIGHT = 1

const limiters = new WeakMap<QueryClient, Limiter>()

/**
 * Gives the limiter for a query client's daily usage requests. It is separate
 * from the totals limiter, so the sidebar's totals keep both of their slots
 * while the overview's chart loads.
 *
 * @param client - The query client the requests belong to.
 * @returns The client's limiter.
 */
export function dailyUsageLimiterFor(client: QueryClient): Limiter {
  let limiter = limiters.get(client)
  if (limiter === undefined) {
    limiter = createLimiter(MAX_DAILY_USAGE_IN_FLIGHT)
    limiters.set(client, limiter)
  }
  return limiter
}
