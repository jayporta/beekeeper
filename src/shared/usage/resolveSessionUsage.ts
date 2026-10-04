/** What a session's own usage is worked out from. */
export interface SessionUsageInput {
  /** The total tokens the session recorded for itself, or `null` when it recorded none. */
  readonly recordedTokens: number | null
  /** The cost the session recorded for itself, in US dollars, or `null` when it recorded none. */
  readonly recordedUsd: number | null
  /** The tokens the session's own transcript reports, or `null` when it has none to report. */
  readonly transcriptTokens: number | null
  /** How many subagent transcripts the session has, or `null` when its folder couldn't be read. */
  readonly subagentCount: number | null
}

/** A session's own usage, as shown. */
export interface ResolvedSessionUsage {
  /** The session's own tokens, or `null` when there is no figure. */
  readonly tokens: number | null
  /** The session's own recorded cost in US dollars, or `null` when not recorded. */
  readonly usd: number | null
  /** Whether `tokens` leaves something out. */
  readonly tokensPartial: boolean
}

/**
 * Works out one session's own usage. A session that recorded no token total,
 * as one still running or crashed has, reports the total its transcript holds
 * instead. That figure leaves out the session's subagents, since their
 * transcripts are not in it, so it is partial when the session has subagents
 * or an unknown number of them. The cost stays empty: it is never estimated.
 *
 * @remarks
 * Every view that shows a session's own usage, in the renderer or the main
 * process, uses this one rule, so a figure never differs between screens.
 *
 * @param input - The session's recorded and transcript totals, and its subagent count.
 * @returns The tokens, the cost, and whether the tokens are partial.
 */
export function resolveSessionUsage(input: SessionUsageInput): ResolvedSessionUsage {
  const { recordedTokens, recordedUsd, transcriptTokens, subagentCount } = input
  const fallback = recordedTokens === null && transcriptTokens !== null
  return {
    tokens: fallback ? transcriptTokens : recordedTokens,
    usd: recordedUsd,
    tokensPartial: fallback && (subagentCount === null || subagentCount > 0)
  }
}
