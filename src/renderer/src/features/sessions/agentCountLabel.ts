import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import type { SessionsT } from './sessionsT'

/** How many teammates and subagents a session has, counting an unknown subagent count as none. */
function agentCounts(item: SessionListItemDto): { teammateCount: number; subagentCount: number } {
  return {
    teammateCount: item.team?.kind === 'lead' ? item.team.teammates.length : 0,
    subagentCount: item.subagentCount ?? 0
  }
}

/**
 * Whether a session has any teammates or subagents.
 *
 * @param item - A session list item.
 * @returns `true` when it has at least one. `false` when it has none or when that can't be told.
 */
export function hasAgents(item: SessionListItemDto): boolean {
  const { teammateCount, subagentCount } = agentCounts(item)
  return teammateCount > 0 || subagentCount > 0
}

/**
 * Describes the agents a session used, for a card's agent count: the
 * teammates grouped under a lead and the subagents it spawned, as in
 * "3 teammates, 2 subagents".
 *
 * @param item - A session list item.
 * @param t - The sessions translate function.
 * @returns The text, `'None'` when the session used neither, or `null` when
 *   that can't be told: the summary couldn't be read, or the subagent count is
 *   unknown and there are no teammates.
 */
export function agentCountLabel(item: SessionListItemDto, t: SessionsT): string | null {
  if (!item.summary.ok) return null

  const { teammateCount, subagentCount } = agentCounts(item)
  const teammates = teammateCount > 0 ? t('agents.teammates', { count: teammateCount }) : null
  const subagents = subagentCount > 0 ? t('agents.subagents', { count: subagentCount }) : null

  if (teammates !== null && subagents !== null) return t('agents.both', { teammates, subagents })
  if (teammates !== null || subagents !== null) return teammates ?? subagents
  return item.subagentCount === null ? null : t('agents.none')
}
