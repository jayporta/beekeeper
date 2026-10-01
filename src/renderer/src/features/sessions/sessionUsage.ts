import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** One usage figure pair a table cell shows. */
export interface UsageFigures {
  /** Recorded tokens across every class, or `null` when not recorded. */
  readonly tokens: number | null
  /** Recorded API-equivalent cost in US dollars, or `null` when not recorded. */
  readonly usd: number | null
  /** Whether the token figure leaves something out. */
  readonly tokensPartial: boolean
  /** Whether the cost figure leaves something out. */
  readonly usdPartial: boolean
}

/** The usage a table row shows. */
export interface SessionUsage {
  /** The session's own recorded usage. Never partial. */
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
 * @param item - A session list item.
 * @returns The usage.
 */
export function sessionUsage(item: SessionListItemDto): SessionUsage {
  if (item.team?.kind === 'lead') {
    const rollup = item.team.usage
    const listIncomplete = rollup.missingTeammates > 0 || rollup.teamListsTruncated
    return {
      session: {
        tokens: rollup.leadTokens,
        usd: rollup.leadUSD,
        tokensPartial: false,
        usdPartial: false
      },
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
    session: {
      tokens: own?.totalTokens ?? null,
      usd: own?.totalUSD ?? null,
      tokensPartial: false,
      usdPartial: false
    },
    team: null
  }
}
