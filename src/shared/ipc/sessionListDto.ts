import type { IpcResult } from './ipcResult'

/** What a scan of a session's transcript found, without its agent tree. */
export interface SessionSummaryDto {
  /** The session's latest generated title, capped in length, or `null`. */
  readonly title: string | null
  /** What the session recorded about its own cost, or `null` when it recorded none. */
  readonly cost: { readonly totalUSD: number | null } | null
  /** The span of the file's timestamps, or `null` when no record has one. */
  readonly activity: { readonly earliestMs: number; readonly latestMs: number } | null
  /** How many lines could not be read as records. */
  readonly skippedLines: number
}

/** One session in a project's session list. */
export interface SessionListItemDto {
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
}
