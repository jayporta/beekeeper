import type { ProjectDirName, SessionId } from '../transcript/ids'
import type { SessionSummary } from '../transcript/summary/sessionSummary'

/** Identifies one session by its project folder and transcript id. */
export interface SessionRef {
  /** The project folder name the session's transcript lives under. */
  readonly projectDirName: ProjectDirName
  /** The session's transcript id. */
  readonly sessionId: SessionId
}

/** A session's summary, alongside the ref that locates its transcript. */
export interface SummarizedSession {
  /** The ref that locates the session's transcript. */
  readonly ref: SessionRef
  /** The session's summary. */
  readonly summary: SessionSummary
}

/** One agent session grouped under the lead session that spawned it. */
export interface Teammate {
  /** The teammate's own session. */
  readonly session: SummarizedSession
  /**
   * `spawn` when one of the lead's spawns matched this session's folded
   * (team, name) pair; `team` when only the folded team matched. A match
   * is a grouping hint, not provenance: any transcript can claim any pair.
   */
  readonly joinedBy: 'spawn' | 'team'
  /**
   * Whether the lead this teammate is grouped under recorded a stop for its
   * folded (team, name) pair. Stops carry no time, so a same-named session
   * respawned under that lead after a stop also reads as stopped.
   */
  readonly stopped: boolean
}

/** A lead session and the teammate sessions grouped under it. */
export interface LeadGroup {
  /** The lead session. */
  readonly lead: SummarizedSession
  /** Its teammates: spawn-joined ones first, in that lead's spawn order (ties by start time), then team-joined ones by start time. */
  readonly teammates: readonly Teammate[]
}

/**
 * Agent sessions no lead in the input claimed, grouped by folded team.
 * `teamName: null` holds sessions with no usable team of their own.
 */
export interface UngroupedTeam {
  /**
   * The team's display spelling, taken from its earliest-starting member,
   * or `null` when the group has no usable team.
   */
  readonly teamName: string | null
  /** The ungrouped sessions, ordered by start time. */
  readonly members: readonly SummarizedSession[]
}

/**
 * The result of joining a collection of session summaries into teams.
 * Every agent session in the input appears exactly once, either as a
 * teammate under a lead or as a member of an ungrouped team. Two agent
 * sessions that share a folded (team, name) pair each still appear as
 * their own row, never merged.
 */
export interface TeamGrouping {
  /** Every lead-role session in the input, even one with no teammates. */
  readonly leads: readonly LeadGroup[]
  /** Agent sessions no lead in the input claimed, grouped by folded team. */
  readonly ungrouped: readonly UngroupedTeam[]
}
