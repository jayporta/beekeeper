import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { sessionUsage, type UsageFigures } from './sessionUsage'

/** The usage figures a session card shows. */
export interface CardFigures {
  /** The tokens and cost to show, or `null` when the card has none to show. */
  readonly figures: UsageFigures | null
  /** Whether `figures` is the team's total rather than the session's own. */
  readonly teamTotal: boolean
}

/**
 * Picks the figures a session card shows. A lead with a team shows the team's
 * total. When the team recorded neither tokens nor cost, it shows the lead's
 * own figures, transcript fallback included, and they are not a team total.
 * Any other session shows its own figures. A session with neither tokens nor
 * cost, such as one whose summary couldn't be read, has no figures.
 *
 * @param item - A session list item.
 * @returns The figures and whether they are a team total.
 */
export function cardFigures(item: SessionListItemDto): CardFigures {
  const { session, team } = sessionUsage(item)
  const teamTotal = team !== null && (team.tokens !== null || team.usd !== null)
  const shown = teamTotal ? team : session
  const hasFigures = shown.tokens !== null || shown.usd !== null
  return { figures: hasFigures ? shown : null, teamTotal: hasFigures && teamTotal }
}
