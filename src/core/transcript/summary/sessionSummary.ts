import type { AgentSignals } from '../signals/agentSignals'
import type { SessionRole } from '../sessionRole'
import type { TranscriptTeamSpawns } from '../teammateSpawn'
import type { LeadUsage } from './leadUsage'

/**
 * The window a transcript's records cover, taken as the smallest and
 * largest timestamp in the file rather than its first and last lines, since
 * timestamps within a transcript run backwards.
 */
export interface ActivitySpan {
  /** The smallest timestamp in the file, in milliseconds since the Unix epoch. */
  readonly earliestMs: number
  /** The largest timestamp in the file, in milliseconds since the Unix epoch. */
  readonly latestMs: number
}

/**
 * What a session recorded about its own usage. Holds only what a summary
 * displays, rather than the whole `cost-state` record, which carries
 * unknown fields that would otherwise sit in the summary cache for as long
 * as the app runs.
 */
export interface RecordedUsage {
  /**
   * The session's total cost in US dollars, or `null` when the record
   * carried no total.
   */
  readonly totalUSD: number | null
  /**
   * The session's recorded total across every token class, or `null` when
   * the record held no model usage or the sum is not finite.
   */
  readonly totalTokens: number | null
}

/** A plan limit a session hit, from the `quotaLimits` of a rejected request. */
export interface LimitHit {
  /** Which plan limit rejected the request: the 5-hour or the 7-day window. */
  readonly window: 'fiveHour' | 'sevenDay'
  /** When that window resets, in milliseconds since the Unix epoch. */
  readonly resetsAtMs: number
}

/**
 * What one pass over a transcript reveals about a session, without building
 * its agent tree or totalling its usage.
 */
export interface SessionSummary {
  /**
   * The session's latest generated title, capped at a displayable length,
   * or `null` when it has none.
   */
  readonly title: string | null
  /**
   * What the session recorded about its own usage, or `null` when it
   * recorded none. Claude Code writes that record at exit, so `null` marks
   * a session that is still running or that crashed, and means "no usage
   * recorded" rather than a usage of zero.
   */
  readonly usage: RecordedUsage | null
  /** The span the file's timestamps cover, or `null` when no record carries one. */
  readonly activity: ActivitySpan | null
  /**
   * How many lines the scan could not read as a record. Never their
   * content, since transcripts are untrusted input.
   */
  readonly skippedLines: number
  /**
   * Whether the transcript belongs to a lead session or a teammate agent.
   * Meaningful only for a top-level transcript: `lead` means no agent
   * marker was seen, as in a subagent transcript or one written by an older
   * Claude Code version, rather than a claim that a session led a team.
   */
  readonly role: SessionRole
  /**
   * The teammates the transcript spawned and stopped, collected on every
   * transcript, since an agent session can spawn teammates too. Both lists
   * are empty for a transcript that spawned none.
   */
  readonly teamSpawns: TranscriptTeamSpawns
  /** The transcript's latest model, as `createLatestModelObserver` picks it, or `null`. */
  readonly model: string | null
  /**
   * The plan limit the session hit with the latest reset, or `null` when no
   * request was rejected for one.
   */
  readonly limitHit: LimitHit | null
  /**
   * The tokens the transcript's own assistant records report, one figure per
   * message id, across every token class. Excludes subagent transcripts. It
   * is what this file reports, not necessarily what the session spent, and
   * is `null` when there is no valid assistant usage, the sum is not finite,
   * or the transcript held more distinct messages than the scan keeps.
   */
  readonly transcriptTokens: number | null
  /**
   * The transcript's own assistant usage by 15-minute slot and model, for
   * usage over time. Empty when the transcript has no valid assistant
   * record, and `null` only when it held more distinct messages than the
   * scan keeps.
   */
  readonly leadUsage: LeadUsage | null
  /**
   * The off-the-rails counts for the transcript's own tool calls, results,
   * compactions and agent kills. Excludes subagent transcripts. Its
   * `partial` flag is set when the transcript held more events than the scan
   * keeps.
   */
  readonly signals: AgentSignals
}
