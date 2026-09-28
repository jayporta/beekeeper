/**
 * A lead's cost, rolled up from the totals each session recorded for
 * itself. Only recorded values are summed: a session with no recorded total
 * is counted, never estimated or treated as zero.
 */
export interface TeamCostRollupDto {
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
   * How many distinct (team, name) pairs the lead spawned that no teammate
   * grouped under it matches. A pair another lead also spawned and that
   * joined under that lead counts as missing here.
   */
  readonly missingTeammates: number
  /**
   * Whether the lead's spawn or stop list hit its cap, so `missingTeammates`
   * may undercount and a teammate grouped under it may read as not stopped
   * when it was.
   */
  readonly teamListsTruncated: boolean
}

/**
 * A lead session that has teammates grouped under it, spawned ones that
 * never appeared, or a spawn or stop list that hit its cap.
 */
export interface LeadSessionTeamDto {
  /** Discriminates the entry. */
  readonly kind: 'lead'
  /**
   * The ids of the sessions grouped under this lead, spawn-joined ones first
   * in the lead's spawn order, then team-joined ones by start time. Its
   * length is the teammate count.
   */
  readonly teammateSessionIds: readonly string[]
  /** The team's cost, rolled up over the lead and its teammates. */
  readonly cost: TeamCostRollupDto
}

/** A teammate agent session grouped under the lead that spawned it. */
export interface TeammateSessionTeamDto {
  /** Discriminates the entry. */
  readonly kind: 'teammate'
  /** The id of the lead session this teammate is grouped under. */
  readonly leadSessionId: string
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

/** A teammate agent session that no lead in the project claimed. */
export interface UngroupedSessionTeamDto {
  /** Discriminates the entry. */
  readonly kind: 'ungrouped'
  /** The team's display spelling, or `null` when the session has no usable team. */
  readonly teamName: string | null
}

/** How a session relates to a team: a lead of one, a member of one, or an orphaned member. */
export type SessionTeamDto = LeadSessionTeamDto | TeammateSessionTeamDto | UngroupedSessionTeamDto
