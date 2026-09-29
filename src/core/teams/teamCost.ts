import { spawnPairOrder } from './spawnPairOrder'
import { agentPairKey } from './teamKey'
import type { LeadGroup, SummarizedSession } from './teamGrouping'

/**
 * A lead group's cost, rolled up from the totals each session recorded for
 * itself. Only recorded values are summed: a session that recorded no
 * total is counted, never estimated or treated as zero.
 */
export interface TeamCostRollup {
  /**
   * The lead's own recorded total in US dollars, or `null` when it recorded
   * none. It already covers the lead's plain subagents, so subagent
   * transcript usage is never added on top.
   */
  readonly leadUSD: number | null
  /**
   * The lead's total plus each grouped teammate's recorded total, summing
   * only known values in the group's teammate order, or `null` when no
   * total is known or the sum is not finite.
   */
  readonly teamUSD: number | null
  /** How many sessions, the lead and its teammates, recorded no cost or no total. */
  readonly sessionsWithoutCost: number
  /**
   * How many distinct folded (team, name) pairs the lead spawned that no
   * teammate in the group matches. A pair another lead also spawned and
   * that joined under that lead counts as missing here.
   */
  readonly missingTeammates: number
  /**
   * Whether the lead's spawns or its `TaskStop` calls hit their cap and
   * one was dropped. It can over-report, since a dropped call may have been
   * a repeat or a stop that would have been excluded. When set,
   * `missingTeammates` may undercount, since a dropped spawn's pair is never
   * counted; `teamUSD` may too, when that teammate joined another lead or
   * stayed ungrouped; and a teammate grouped under this lead may read as
   * joined by team rather than by spawn, or as not stopped when it was.
   */
  readonly teamListsTruncated: boolean
}

function recordedTotal(session: SummarizedSession): number | null {
  return session.summary.cost?.totalUSD ?? null
}

function countMissingTeammates(group: LeadGroup): number {
  const matched = new Set<string>()
  for (const teammate of group.teammates) {
    const key = agentPairKey(teammate.session.summary.role)
    if (key !== null) matched.add(key)
  }

  let missing = 0
  for (const key of spawnPairOrder(group.lead.summary.teamSpawns.spawns).keys()) {
    if (!matched.has(key)) missing += 1
  }
  return missing
}

/**
 * Rolls a lead group's recorded costs up into a team total. A recorded
 * total of exactly zero is a known cost, not a missing one.
 *
 * @param group - A lead and the teammates grouped under it.
 * @returns The rollup. See {@link TeamCostRollup}.
 */
export function rollupTeamCost(group: LeadGroup): TeamCostRollup {
  const sessions = [group.lead, ...group.teammates.map((teammate) => teammate.session)]
  const known = sessions.map(recordedTotal).filter((total): total is number => total !== null)
  const sum = known.reduce((acc, total) => acc + total, 0)

  return {
    leadUSD: recordedTotal(group.lead),
    teamUSD: known.length > 0 && Number.isFinite(sum) ? sum : null,
    sessionsWithoutCost: sessions.length - known.length,
    missingTeammates: countMissingTeammates(group),
    teamListsTruncated: group.lead.summary.teamSpawns.truncated
  }
}
