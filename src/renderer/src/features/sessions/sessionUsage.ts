import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { resolveSessionUsage } from '../../../../shared/usage/resolveSessionUsage'

/** One usage figure pair a card shows. */
export interface UsageFigures {
  /** Tokens across every class, or `null` when there is no figure. */
  readonly tokens: number | null
  /** Recorded API-equivalent cost in US dollars, or `null` when not recorded. */
  readonly usd: number | null
  /** Whether the token figure leaves something out. */
  readonly tokensPartial: boolean
  /** Whether the cost figure leaves something out. */
  readonly usdPartial: boolean
}

/** The usage a session card shows. */
export interface SessionUsage {
  /** The session's own usage. Its tokens are partial only when taken from its transcript. */
  readonly session: UsageFigures
  /** The team's rolled-up usage, or `null` when the row is not a lead with a team. */
  readonly team: UsageFigures | null
}

/**
 * Reads a row's usage. A lead with a team reports its own totals and the
 * team's rolled-up totals, each marked partial when the roll-up leaves
 * something out. Any other session reports its own recorded totals and no
 * team usage.
 *
 * A session with no recorded token total, as one still running or crashed
 * has, reports the total its transcript holds instead, marked partial when
 * the session has subagents or an unknown number of them, since their
 * transcripts are not in that figure. Its cost stays empty. This holds for a
 * lead with a team too, so a running lead's session figure can exceed its
 * team figure, which counts only recorded totals.
 *
 * @param item - A session list item.
 * @returns The usage.
 */
export function sessionUsage(item: SessionListItemDto): SessionUsage {
  if (item.team?.kind === 'lead') {
    const rollup = item.team.usage
    const listIncomplete = rollup.missingTeammates > 0 || rollup.teamListsTruncated
    return {
      session: sessionFigures(item, { tokens: rollup.leadTokens, usd: rollup.leadUSD }),
      team: {
        tokens: rollup.teamTokens,
        usd: rollup.teamUSD,
        tokensPartial: rollup.sessionsWithoutTokens > 0 || listIncomplete,
        usdPartial: rollup.sessionsWithoutCost > 0 || listIncomplete
      }
    }
  }
  const own = item.summary.ok ? item.summary.value.usage : null
  return {
    session: sessionFigures(item, { tokens: own?.totalTokens ?? null, usd: own?.totalUSD ?? null }),
    team: null
  }
}

/**
 * Builds the session's own figures from its recorded totals, falling back to
 * the transcript's token total when none was recorded.
 */
function sessionFigures(
  item: SessionListItemDto,
  recorded: Pick<UsageFigures, 'tokens' | 'usd'>
): UsageFigures {
  const resolved = resolveSessionUsage({
    recordedTokens: recorded.tokens,
    recordedUsd: recorded.usd,
    transcriptTokens: item.summary.ok ? item.summary.value.transcriptTokens : null,
    subagentCount: item.subagentCount
  })
  return { ...resolved, usdPartial: false }
}
