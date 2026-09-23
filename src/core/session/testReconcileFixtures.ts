import type { PriceTokensResult } from '../pricing/priceTokens'
import { emptyTokenCounts } from '../pricing/tokenCounts'
import type { CostStateRecord } from '../transcript/schemas'
import type { AgentUsage } from './agentUsage'
import type { TokenGroup } from './tokenGroup'

/**
 * Builds a token group for `model`, priced at $1 at standard speed unless overridden.
 * @param model - The group's raw model id.
 * @param overrides - The speed, price, or token counts to use instead of the defaults.
 * @returns The token group.
 */
export function group(
  model: string,
  overrides: Partial<{
    speed: string
    price: PriceTokensResult
    tokens: Partial<typeof emptyTokenCounts>
  }> = {}
): TokenGroup {
  return {
    model,
    speed: overrides.speed ?? 'standard',
    tokens: { ...emptyTokenCounts, ...overrides.tokens },
    price: overrides.price ?? { kind: 'priced', usd: 1 }
  }
}

/**
 * Builds an agent's usage from token groups, with no skipped lines.
 * @param tokenGroups - The agent's token groups.
 * @returns The agent's usage.
 */
export function agent(...tokenGroups: TokenGroup[]): AgentUsage {
  return { tokenGroups, messageCount: tokenGroups.length, skippedLines: 0 }
}

/**
 * Builds a `cost-state` record from the given fields.
 * @param state - The record's fields besides `type`.
 * @returns The cost-state record.
 */
export function costState(state: Partial<CostStateRecord>): CostStateRecord {
  return { type: 'cost-state', ...state }
}
