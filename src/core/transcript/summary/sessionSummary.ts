import type { SessionRole } from '../sessionRole'

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
 * What a session recorded about its own cost. Holds only what a summary
 * displays, rather than the whole `cost-state` record, which carries
 * unknown fields that would otherwise sit in the summary cache for as long
 * as the app runs.
 */
export interface RecordedCost {
  /**
   * The session's total cost in US dollars, or `null` when the record
   * carried no total.
   */
  readonly totalUSD: number | null
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
   * What the session recorded about its own cost, or `null` when it
   * recorded none. Claude Code writes that record at exit, so `null` marks
   * a session that is still running or that crashed, and means "no cost
   * recorded" rather than a cost of zero.
   */
  readonly cost: RecordedCost | null
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
}
