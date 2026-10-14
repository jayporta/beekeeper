import { agentCountLabel, hasAgents } from '@renderer/features/sessions/agentCountLabel'
import { formatLastActive } from '@renderer/features/sessions/formatLastActive'
import type { SessionRow } from '../../../../shared/sessions/sessionRow'
import type { SessionsT } from '@renderer/features/sessions/sessionsT'

/** The team a session belongs to, by name: its own, or for a lead, its first teammate that names one. */
function teamNameOf(row: SessionRow): string | null {
  const { item } = row
  if (item.team?.kind === 'ungrouped') return item.team.teamName
  if (item.summary.ok && item.summary.value.role.kind === 'agent') {
    return item.summary.value.role.teamName
  }
  for (const { item: teammate } of row.teammates) {
    if (teammate.summary.ok && teammate.summary.value.role.kind === 'agent') {
      const { teamName } = teammate.summary.value.role
      if (teamName !== null) return teamName
    }
  }
  return null
}

/**
 * The facts under a session's title, in order: when it started, its team, and
 * its agents. A fact the session doesn't have or doesn't record is left out,
 * so the line has no gaps.
 *
 * @param row - The session's row in the sessions list.
 * @param t - The sessions translate function.
 * @returns The parts, in order. Transcript-derived: render as plain text.
 */
export function sessionMetaLine(row: SessionRow, t: SessionsT): readonly string[] {
  const { item } = row
  const activity = item.summary.ok ? item.summary.value.activity : null
  const teamName = teamNameOf(row)

  return [
    formatLastActive(activity?.earliestMs ?? null, t),
    teamName === null ? null : t('notes.team', { name: teamName }),
    hasAgents(item) ? agentCountLabel(item, t) : null
  ].filter((part) => part !== null)
}
