import type { LeadGroup, TeamGrouping } from '../../core/teams/teamGrouping'
import { rollupTeamUsage } from '../../core/teams/teamUsage'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { mapSessionRef } from './mapSessionRef'
import { sessionRefKey } from './sessionRefKey'

function mapLeadGroup(group: LeadGroup, into: Map<string, SessionTeamDto>): void {
  const usage = rollupTeamUsage(group)
  const lead = mapSessionRef(group.lead.ref)

  for (const teammate of group.teammates) {
    into.set(sessionRefKey(teammate.session.ref), {
      kind: 'teammate',
      lead,
      joinedBy: teammate.joinedBy,
      stopped: teammate.stopped
    })
  }

  const isSolo =
    group.teammates.length === 0 && usage.missingTeammates === 0 && !usage.teamListsTruncated
  if (isSolo) return
  into.set(sessionRefKey(lead), {
    kind: 'lead',
    teammates: group.teammates.map((teammate) => mapSessionRef(teammate.session.ref)),
    usage: {
      leadUSD: usage.leadUSD,
      teamUSD: usage.teamUSD,
      sessionsWithoutCost: usage.sessionsWithoutCost,
      leadTokens: usage.leadTokens,
      teamTokens: usage.teamTokens,
      sessionsWithoutTokens: usage.sessionsWithoutTokens,
      missingTeammates: usage.missingTeammates,
      teamListsTruncated: usage.teamListsTruncated,
      signalTotals: {
        toolErrors: usage.signalTotals.toolErrors,
        compactions: usage.signalTotals.compactions,
        agentsKilled: usage.signalTotals.agentsKilled,
        partial: usage.signalTotals.partial
      }
    }
  })
}

/**
 * Maps a team grouping to what each session's list item carries, field by
 * field, so no summary field (its spawn and stop labels among them) crosses
 * the bridge. A lead with no teammates, no missing spawned teammate, and no
 * capped spawns or stops (see `teamListsTruncated`) gets no entry, since
 * its team total would only repeat its own usage.
 *
 * @param grouping - The grouping of one project family's sessions.
 * @returns Each grouped or ungrouped session's team entry, keyed by
 * {@link sessionRefKey} of its folder and id, never by bare id.
 */
export function mapSessionTeams(grouping: TeamGrouping): Map<string, SessionTeamDto> {
  const teams = new Map<string, SessionTeamDto>()
  for (const group of grouping.leads) mapLeadGroup(group, teams)
  for (const team of grouping.ungrouped) {
    for (const member of team.members) {
      teams.set(sessionRefKey(member.ref), { kind: 'ungrouped', teamName: team.teamName })
    }
  }
  return teams
}
