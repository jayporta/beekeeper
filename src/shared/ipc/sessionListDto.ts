import type { IpcResult } from './ipcResult'
import type { SessionRoleDto } from './sessionRoleDto'
import type { SessionTeamDto } from './sessionTeamDto'

/** What a scan of a session's transcript found, without its agent tree. */
export interface SessionSummaryDto {
  /** The session's latest generated title, capped in length, or `null`. */
  readonly title: string | null
  /** What the session recorded about its own usage, or `null` when it recorded none. */
  readonly usage: {
    /** The recorded total cost in US dollars, or `null` when the record carried none. */
    readonly totalUSD: number | null
    /** The recorded total across every token class, or `null` when it held no model usage or the sum is not finite. */
    readonly totalTokens: number | null
  } | null
  /** The span of the file's timestamps, or `null` when no record has one. */
  readonly activity: { readonly earliestMs: number; readonly latestMs: number } | null
  /** How many lines could not be read as records. */
  readonly skippedLines: number
  /** Whether the session is a lead or a teammate agent; `lead` means no agent marker was seen. */
  readonly role: SessionRoleDto
  /** The transcript's latest model as the summary scan picks it, or `null`. */
  readonly model: string | null
  /** The plan limit the session hit with the latest reset, or `null` when it hit none. */
  readonly limitHit: {
    /** Which plan limit: the 5-hour or the 7-day window. */
    readonly window: 'fiveHour' | 'sevenDay'
    /** When that window resets, in milliseconds since the Unix epoch. */
    readonly resetsAtMs: number
  } | null
  /**
   * The tokens the transcript's own assistant records report, one figure per
   * message id, excluding subagent transcripts. `null` when there is no valid
   * assistant usage, the sum is not finite, or the transcript held more
   * distinct messages than the scan keeps.
   */
  readonly transcriptTokens: number | null
}

/**
 * One session in a project's session list. The list holds the project's own
 * sessions plus any session from another folder of the same project family
 * that is grouped as a teammate under one of the project's leads.
 */
export interface SessionListItemDto {
  /** The project folder the session's transcript lives under, exactly as on disk. */
  readonly projectDirName: string
  /** The session's id, a lowercase UUID. */
  readonly sessionId: string
  /** The transcript's last-modified time in epoch milliseconds, or `null` when it couldn't be read. */
  readonly modifiedMs: number | null
  /** The transcript's size in bytes, or `null` when it couldn't be read. */
  readonly sizeBytes: number | null
  /** How many subagent transcripts the session has, or `null` when its folder couldn't be read. */
  readonly subagentCount: number | null
  /** The session's summary, or why it is unavailable. */
  readonly summary: IpcResult<SessionSummaryDto>
  /**
   * How the session relates to a team, or `null` when its transcript or
   * summary couldn't be read, or when it is a lead with no teammates, no
   * spawned teammate missing, and no capped spawns or stops (see
   * `TeamUsageRollupDto.teamListsTruncated`), since a solo lead's team total
   * would only repeat its own usage.
   */
  readonly team: SessionTeamDto | null
}
