import { rollupTeamCost } from '../../core/teams/teamCost'
import type { LeadGroup, TeamGrouping } from '../../core/teams/teamGrouping'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'

function mapLeadGroup(group: LeadGroup, into: Map<string, SessionTeamDto>): void {
  const cost = rollupTeamCost(group)
  const leadSessionId = group.lead.ref.sessionId

  for (const teammate of group.teammates) {
    into.set(teammate.session.ref.sessionId, {
      kind: 'teammate',
      leadSessionId,
      joinedBy: teammate.joinedBy,
      stopped: teammate.stopped
    })
  }

  const isSolo =
    group.teammates.length === 0 && cost.missingTeammates === 0 && !cost.teamListsTruncated
  if (isSolo) return
  into.set(leadSessionId, {
    kind: 'lead',
    teammateSessionIds: group.teammates.map((teammate) => teammate.session.ref.sessionId),
    cost: {
      leadUSD: cost.leadUSD,
      teamUSD: cost.teamUSD,
      sessionsWithoutCost: cost.sessionsWithoutCost,
      missingTeammates: cost.missingTeammates,
      teamListsTruncated: cost.teamListsTruncated
    }
  })
}

/**
 * Maps a team grouping to what each session's list item carries, field by
 * field, so no summary field (its spawn and stop labels among them) crosses
 * the bridge. A lead with no teammates, no missing spawned teammate, and no
 * capped spawns or stops (see `teamListsTruncated`) gets no entry, since
 * its team total would only repeat its own cost.
 *
 * @param grouping - The grouping of one project's sessions.
 * @returns Each grouped or ungrouped session's id mapped to its team entry.
 */
export function mapSessionTeams(grouping: TeamGrouping): Map<string, SessionTeamDto> {
  const teams = new Map<string, SessionTeamDto>()
  for (const group of grouping.leads) mapLeadGroup(group, teams)
  for (const team of grouping.ungrouped) {
    for (const member of team.members) {
      teams.set(member.ref.sessionId, { kind: 'ungrouped', teamName: team.teamName })
    }
  }
  return teams
}
