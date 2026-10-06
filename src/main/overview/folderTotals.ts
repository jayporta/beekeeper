import type { SessionSummary } from '../../core/transcript/summary/sessionSummary'
import { resolveSessionUsage } from '../../shared/usage/resolveSessionUsage'

/** One session of a folder, as its totals are worked out from it. */
export interface TotalsSession {
  /** The session's id. */
  readonly sessionId: string
  /** The transcript's last-modified time, or `null` when it couldn't be stat'd. */
  readonly mtimeMs: number | null
  /** How many subagent transcripts the session has, or `null` when its folder couldn't be read. */
  readonly subagentCount: number | null
  /** The session's summary, or `null` when it couldn't be read. */
  readonly summary: Pick<
    SessionSummary,
    'title' | 'usage' | 'activity' | 'skippedLines' | 'role' | 'transcriptTokens'
  > | null
}

/** Options for {@link folderTotals}. */
export interface FolderTotalsOptions {
  /** The folder's own sessions. */
  readonly sessions: readonly TotalsSession[]
  /** The time the window ends at, in milliseconds since the Unix epoch. */
  readonly nowMs: number
  /** How long the window is, in milliseconds. */
  readonly windowMs: number
}

/** How many sessions in the window leave a total incomplete, by reason. A session may count under more than one. */
export interface PartialCounts {
  /** Sessions with no token figure at all, recorded or read from the transcript. */
  readonly withoutTokens: number
  /** Sessions with no recorded cost. */
  readonly withoutCost: number
  /** Sessions whose transcript or summary couldn't be read. */
  readonly unreadable: number
  /**
   * Sessions whose tokens may be low: some transcript lines couldn't be read,
   * or the figure is the transcript's own and leaves its subagents out. Each
   * session counts once.
   */
  readonly lowTokens: number
  /** Sessions whose subagents folder couldn't be read, so their subagents are missing from the agent count. */
  readonly uncountedSubagents: number
  /** Sessions with no timestamps, counted by when their file was last written. */
  readonly undated: number
}

/** The lead or solo session of a folder that was active last in the window. */
export interface LatestSession {
  /** The session's id. */
  readonly sessionId: string
  /** Its title, or `null` when it has none. Transcript-derived. */
  readonly title: string | null
  /** When it was last active, in milliseconds since the Unix epoch. */
  readonly latestMs: number
}

/** What one folder's own sessions add up to in a window. */
export interface FolderTotals {
  /** The tokens of every session in the window, each counted from its own figure. */
  readonly tokens: number
  /** The recorded cost of every session in the window, in US dollars. */
  readonly usd: number
  /** How many lead and solo sessions are in the window. A teammate is not a session. */
  readonly sessions: number
  /** How many agents: every session in the window, teammates included, and each one's subagents. */
  readonly agents: number
  /** The lead or solo session active last in the window, or `null` when none has an activity time. */
  readonly latest: LatestSession | null
  /** Why the totals may be low. */
  readonly partial: PartialCounts
}

/**
 * Adds up a folder's own sessions over a window.
 *
 * @remarks
 * A session is in the window when it was last active at or after the window's
 * start. One with no timestamps, or whose summary couldn't be read, is in it
 * when its file was written at or after the start, and is marked as such. A
 * transcript that couldn't be stat'd has no time to go by, so it is only
 * counted as unreadable. Tokens and cost are each session's own, so a lead's
 * total never includes its teammates', which are separate sessions with their
 * own totals, and nothing is counted twice. See {@link resolveSessionUsage} for
 * a session with no recorded total.
 *
 * @param options - The sessions, the end of the window, and its length.
 * @returns The totals and the counts of sessions that leave them incomplete.
 */
export function folderTotals(options: FolderTotalsOptions): FolderTotals {
  const cutoff = options.nowMs - options.windowMs
  let tokens = 0
  let usd = 0
  let sessions = 0
  let agents = 0
  let latest: LatestSession | null = null
  const partial = {
    withoutTokens: 0,
    withoutCost: 0,
    unreadable: 0,
    lowTokens: 0,
    uncountedSubagents: 0,
    undated: 0
  }

  for (const session of options.sessions) {
    const { mtimeMs, summary } = session
    if (mtimeMs === null) {
      partial.unreadable += 1
      continue
    }
    const latestMs = summary?.activity?.latestMs ?? null
    if ((latestMs ?? mtimeMs) < cutoff) continue

    agents += 1 + (session.subagentCount ?? 0)
    if (summary === null) {
      partial.unreadable += 1
      continue
    }
    if (latestMs === null) partial.undated += 1

    const resolved = resolveSessionUsage({
      recordedTokens: summary.usage?.totalTokens ?? null,
      recordedUsd: summary.usage?.totalUSD ?? null,
      transcriptTokens: summary.transcriptTokens,
      subagentCount: session.subagentCount
    })
    if (resolved.tokens === null) partial.withoutTokens += 1
    else tokens += resolved.tokens
    if (resolved.usd === null) partial.withoutCost += 1
    else usd += resolved.usd
    if (summary.skippedLines > 0 || resolved.tokensPartial) partial.lowTokens += 1
    if (session.subagentCount === null) partial.uncountedSubagents += 1

    if (summary.role.kind !== 'lead') continue
    sessions += 1
    if (latestMs === null) continue
    const later =
      latest === null ||
      latestMs > latest.latestMs ||
      (latestMs === latest.latestMs && session.sessionId < latest.sessionId)
    if (later) latest = { sessionId: session.sessionId, title: summary.title, latestMs }
  }

  return { tokens, usd, sessions, agents, latest, partial }
}
