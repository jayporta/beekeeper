import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** The costs a table row shows. */
export interface SessionCosts {
  /** The session's own recorded cost in US dollars, or `null` when not recorded. */
  readonly sessionUSD: number | null
  /** The team's cost, or `null` when the row is not a lead with a team or none is known. */
  readonly teamUSD: number | null
  /** Whether the team cost leaves something out: a session with no cost, a missing teammate, or a capped list. */
  readonly partial: boolean
}

/**
 * Reads a row's costs. A lead with a team reports its own total and the
 * team's rolled-up total, marked partial when the roll-up leaves something
 * out. Any other session reports its own recorded total and no team cost.
 *
 * @param item - A session list item.
 * @returns The costs.
 */
export function sessionCosts(item: SessionListItemDto): SessionCosts {
  if (item.team?.kind === 'lead') {
    const { leadUSD, teamUSD, sessionsWithoutCost, missingTeammates, teamListsTruncated } =
      item.team.cost
    return {
      sessionUSD: leadUSD,
      teamUSD,
      partial: sessionsWithoutCost > 0 || missingTeammates > 0 || teamListsTruncated
    }
  }
  return {
    sessionUSD: item.summary.ok ? (item.summary.value.cost?.totalUSD ?? null) : null,
    teamUSD: null,
    partial: false
  }
}
