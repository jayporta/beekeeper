import type { QueryClient } from '@tanstack/react-query'
import { createLimiter, type Limiter } from '../totalsLimiter'

/**
 * How many folders' daily usage the renderer asks main for at once. Main reads
 * every session of a folder twice over (its summaries, then its daily usage),
 * so one at a time keeps the sidebar's totals from queuing behind this.
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
