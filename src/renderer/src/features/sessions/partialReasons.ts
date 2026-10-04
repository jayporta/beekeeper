import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { cardFigures } from './cardFigures'
import type { SessionRow } from './sessionRow'
import { sessionUsage } from './sessionUsage'

/** Why a card's figures may be lower than the true usage. */
export type PartialReason =
  'unreadableLines' | 'missingTeammates' | 'unrecordedUsage' | 'subagentsExcluded'

/** Whether the session's summary skipped lines it could not read. */
function skippedLines(item: SessionListItemDto): boolean {
  return item.summary.ok && item.summary.value.skippedLines > 0
}

/**
 * Works out why the figures on a card, and on its teammates' chips, may leave
 * something out. The card shows a partial marker when the set is not empty,
 * and the footnote explains each reason in it.
 *
 * - `unreadableLines`: the card's session or one of its teammates skipped
 *   transcript lines.
 * - `missingTeammates`: a spawned teammate is not in the list, or the lead's
 *   spawn or stop lists were capped. Leads only.
 * - `unrecordedUsage`: a session in the team recorded no tokens or no cost.
 *   Leads only.
 * - `subagentsExcluded`: a figure shown is a transcript total, which leaves out
 *   subagents, on the card or on a teammate's chip.
 *
 * A card that shows no figures has no marker to explain, so its own reasons
 * are left out. A chip that shows a transcript total has its own marker, so
 * it still counts.
 *
 * @param row - The card's row, with its teammates.
 * @returns The reasons, empty when the figures are complete.
 */
export function partialReasons(row: SessionRow): ReadonlySet<PartialReason> {
  const { item, teammates } = row
  const reasons = new Set<PartialReason>()
  const { figures, teamTotal } = cardFigures(item)

  if (figures !== null) {
    if (skippedLines(item) || teammates.some((teammate) => skippedLines(teammate.item))) {
      reasons.add('unreadableLines')
    }
    if (item.team?.kind === 'lead') {
      const { usage } = item.team
      if (usage.missingTeammates > 0 || usage.teamListsTruncated) reasons.add('missingTeammates')
      if (usage.sessionsWithoutTokens > 0 || usage.sessionsWithoutCost > 0) {
        reasons.add('unrecordedUsage')
      }
    }
    if (!teamTotal && figures.tokensPartial) reasons.add('subagentsExcluded')
  }

  if (teammates.some((teammate) => sessionUsage(teammate.item).session.tokensPartial)) {
    reasons.add('subagentsExcluded')
  }

  return reasons
}
