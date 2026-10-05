import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'

/** What an agent's tokens cost at API prices. */
export interface ReportCost {
  /** The cost of the groups with a known price, or `null` when no group has one: no tokens, or none priced. */
  readonly usd: number | null
  /** Whether some group has no known price, so `usd` may be low. */
  readonly partial: boolean
}

/**
 * Prices an agent's tokens from its groups. A free group costs nothing and
 * leaves the cost whole. A group with no known price is left out of the sum and
 * makes the cost partial. An agent with no groups has no cost to show.
 *
 * @param report - The agent's report.
 * @returns The cost.
 */
export function reportCost(report: AgentReportDto): ReportCost {
  let usd = 0
  let known = 0
  let unpriced = 0
  for (const { price } of report.tokenGroups) {
    if (price.kind === 'unpriced') {
      unpriced += 1
      continue
    }
    known += 1
    if (price.kind === 'priced') usd += price.usd
  }
  return { usd: known === 0 ? null : usd, partial: unpriced > 0 }
}
