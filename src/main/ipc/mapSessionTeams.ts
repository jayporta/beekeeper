import { rollupTeamCost } from '../../core/teams/teamCost'
import type { LeadGroup, SessionRef, TeamGrouping } from '../../core/teams/teamGrouping'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { sessionRefKey } from './sessionRefKey'

function mapRef(ref: SessionRef): SessionRefDto {
  return { projectDirName: ref.projectDirName, sessionId: ref.sessionId }
}

function mapLeadGroup(group: LeadGroup, into: Map<string, SessionTeamDto>): void {
  const cost = rollupTeamCost(group)
  const lead = mapRef(group.lead.ref)

  for (const teammate of group.teammates) {
    into.set(sessionRefKey(teammate.session.ref), {
      kind: 'teammate',
      lead,
      joinedBy: teammate.joinedBy,
      stopped: teammate.stopped
    })
  }

  const isSolo =
    group.teammates.length === 0 && cost.missingTeammates === 0 && !cost.teamListsTruncated
  if (isSolo) return
  into.set(sessionRefKey(lead), {
    kind: 'lead',
    teammates: group.teammates.map((teammate) => mapRef(teammate.session.ref)),
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
