import type { SessionRefDto } from './sessionRefDto'

/**
 * A lead's usage, rolled up from the totals each session recorded for
 * itself. Only recorded values are summed: a session with no recorded total
 * is counted, never estimated or treated as zero.
 */
export interface TeamUsageRollupDto {
  /**
   * The lead's own recorded total in US dollars, or `null` when it recorded
   * none. It already covers the lead's plain subagents.
   */
  readonly leadUSD: number | null
  /**
   * The lead's total plus each grouped teammate's recorded total, summing
   * only known values, or `null` when no total is known or the sum is not
   * finite.
   */
  readonly teamUSD: number | null
  /** How many sessions, the lead and its teammates, recorded no cost or no total. */
  readonly sessionsWithoutCost: number
  /**
   * The lead's own recorded total across every token class, or `null` when
   * it recorded none. It already covers the lead's plain subagents.
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
   * How many distinct (team, name) pairs the lead spawned that no teammate
   * grouped under it matches. A pair another lead also spawned and that
   * joined under that lead counts as missing here.
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

/**
 * A lead session that has teammates grouped under it, spawned ones that
 * never appeared, or capped spawns or stops (see
 * {@link TeamUsageRollupDto.teamListsTruncated}).
 */
export interface LeadSessionTeamDto {
  /** Discriminates the entry. */
  readonly kind: 'lead'
  /**
   * The sessions grouped under this lead, spawn-joined ones first in the
   * lead's spawn order, then team-joined ones by start time. Its length is
   * the teammate count. A teammate may live in another folder of the
   * lead's project family, so each is a ref, not a bare id.
   */
  readonly teammates: readonly SessionRefDto[]
  /** The team's usage, rolled up over the lead and its teammates. */
  readonly usage: TeamUsageRollupDto
}

/** A teammate agent session grouped under the lead that spawned it. */
export interface TeammateSessionTeamDto {
  /** Discriminates the entry. */
  readonly kind: 'teammate'
  /**
   * The lead session this teammate is grouped under, which may live in
   * another folder of the same project family. A cross-folder teammate is
   * listed under its lead's folder and under its own, with this same lead
   * both times.
   */
  readonly lead: SessionRefDto
  /**
   * `spawn` when one of the lead's spawns matched this session's (team,
   * name) pair, `team` when only the team matched. A match is a grouping
   * hint, not provenance: any transcript can claim any pair.
   */
  readonly joinedBy: 'spawn' | 'team'
  /**
   * Whether the lead this teammate is grouped under recorded a stop for its
   * (team, name) pair. Stops carry no time, so a same-named session
   * respawned under that lead after a stop also reads as stopped.
   */
  readonly stopped: boolean
}

/** A teammate agent session that no lead in the project family claimed. */
export interface UngroupedSessionTeamDto {
  /** Discriminates the entry. */
  readonly kind: 'ungrouped'
  /** The team's display spelling, or `null` when the session has no usable team. */
  readonly teamName: string | null
}

/** How a session relates to a team: a lead of one, a member of one, or an orphaned member. */
export type SessionTeamDto = LeadSessionTeamDto | TeammateSessionTeamDto | UngroupedSessionTeamDto
