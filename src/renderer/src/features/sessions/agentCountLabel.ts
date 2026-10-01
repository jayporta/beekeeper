import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import type { SessionsT } from './sessionsT'

/**
 * Describes the agents a session used, for the table's Agents column: the
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

  const teammateCount = item.team?.kind === 'lead' ? item.team.teammates.length : 0
  const subagentCount = item.subagentCount ?? 0
  const teammates = teammateCount > 0 ? t('agents.teammates', { count: teammateCount }) : null
  const subagents = subagentCount > 0 ? t('agents.subagents', { count: subagentCount }) : null

  if (teammates !== null && subagents !== null) return t('agents.both', { teammates, subagents })
  if (teammates !== null || subagents !== null) return teammates ?? subagents
  return item.subagentCount === null ? null : t('agents.none')
}
