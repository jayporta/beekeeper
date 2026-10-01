import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * Describes the agents a session used, for the table's Agents column: the
 * teammates grouped under a lead and the subagents it spawned, as in
 * "3 teammates, 2 subagents".
 *
 * @param item - A session list item.
 * @returns The text, `'None'` when the session used neither, or `null` when
 *   that can't be told: the summary couldn't be read, or the subagent count is
 *   unknown and there are no teammates.
 */
export function agentCountLabel(item: SessionListItemDto): string | null {
  if (!item.summary.ok) return null

  const teammates = item.team?.kind === 'lead' ? item.team.teammates.length : 0
  const parts: string[] = []
  if (teammates > 0) parts.push(plural(teammates, 'teammate'))
  if (item.subagentCount !== null && item.subagentCount > 0) {
    parts.push(plural(item.subagentCount, 'subagent'))
  }

  if (parts.length > 0) return parts.join(', ')
  return item.subagentCount === null ? null : 'None'
}
