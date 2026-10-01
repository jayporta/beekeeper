import type { RecordedUsage } from '../transcript/summary/sessionSummary'
import { spawnPairOrder } from './spawnPairOrder'
import { agentPairKey } from './teamKey'
import type { LeadGroup, SummarizedSession } from './teamGrouping'

/**
 * A lead group's usage, rolled up from the totals each session recorded for
 * itself. Only recorded values are summed: a session that recorded no
 * total is counted, never estimated or treated as zero.
 */
export interface TeamUsageRollup {
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
   * The lead's own recorded total across every token class, or `null` when
   * it recorded none. Like `leadUSD`, it already covers the lead's plain
   * subagents.
   */
  readonly leadTokens: number | null
  /**
   * The lead's token total plus each grouped teammate's, summing only known
   * values, or `null` when no total is known or the sum is not finite.
   */
  readonly teamTokens: number | null
  /** How many sessions, the lead and its teammates, recorded no usage or no token total. */
  readonly sessionsWithoutTokens: number
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
   * counted; `teamUSD` and `teamTokens` may too, when that teammate joined
   * another lead or stayed ungrouped; and a teammate grouped under this lead
   * may read as joined by team rather than by spawn, or as not stopped when
   * it was.
   */
  readonly teamListsTruncated: boolean
}

interface RecordedSum {
  /** The lead's own value, or `null` when it recorded none. */
  readonly lead: number | null
  /** The sum of every known value, or `null` when none is known or the sum is not finite. */
  readonly team: number | null
  /** How many sessions had no value. */
  readonly missing: number
}

function sumRecorded(
  sessions: readonly SummarizedSession[],
  pick: (usage: RecordedUsage) => number | null
): RecordedSum {
  const values = sessions.map((session) =>
    session.summary.usage ? pick(session.summary.usage) : null
  )
  const known = values.filter((value): value is number => value !== null)
  const sum = known.reduce((acc, value) => acc + value, 0)
  return {
    lead: values[0] ?? null,
    team: known.length > 0 && Number.isFinite(sum) ? sum : null,
    missing: values.length - known.length
  }
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
 * Rolls a lead group's recorded usage up into team totals. A recorded
 * total of exactly zero is a known value, not a missing one, and a session
 * can have a cost without a token total, so the two are counted
 * independently.
 *
 * @param group - A lead and the teammates grouped under it.
 * @returns The rollup. See {@link TeamUsageRollup}.
 */
export function rollupTeamUsage(group: LeadGroup): TeamUsageRollup {
  const sessions = [group.lead, ...group.teammates.map((teammate) => teammate.session)]
  const usd = sumRecorded(sessions, (usage) => usage.totalUSD)
  const tokens = sumRecorded(sessions, (usage) => usage.totalTokens)

  return {
    leadUSD: usd.lead,
    teamUSD: usd.team,
    sessionsWithoutCost: usd.missing,
    leadTokens: tokens.lead,
    teamTokens: tokens.team,
    sessionsWithoutTokens: tokens.missing,
    missingTeammates: countMissingTeammates(group),
    teamListsTruncated: group.lead.summary.teamSpawns.truncated
  }
}
