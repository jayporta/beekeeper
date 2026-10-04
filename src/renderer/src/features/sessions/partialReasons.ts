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
 * Works out why the figures a session shows for itself may leave something
 * out, which its teammates' chips don't count. A view that shows no chips,
 * such as the session detail, explains its figures with these.
 *
 * - `unreadableLines`: the session or one of its teammates skipped transcript
 *   lines.
 * - `missingTeammates`: a spawned teammate is not in the list, or the lead's
 *   spawn or stop lists were capped. Leads only.
 * - `unrecordedUsage`: a session in the team recorded no tokens or no cost.
 *   Leads only.
 * - `subagentsExcluded`: the figure shown is a transcript total, which leaves
 *   out subagents.
 *
 * A session that shows no figures has no marker to explain, so it has no reasons.
 *
 * @param row - The session's row, with its teammates.
 * @returns The reasons, empty when the figures are complete.
 */
export function figureReasons(row: SessionRow): Set<PartialReason> {
  const { item, teammates } = row
  const reasons = new Set<PartialReason>()
  const { figures, teamTotal } = cardFigures(item)
  if (figures === null) return reasons

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
  return reasons
}

/**
 * Works out why the figures on a card, and on its teammates' chips, may leave
 * something out. The card shows a partial marker when the set is not empty,
 * and the footnote explains each reason in it. These are the reasons of
 * {@link figureReasons}, plus `subagentsExcluded` for a chip that shows a
 * transcript total, which leaves out its subagents. A card that shows no
 * figures has no marker of its own, but a chip that shows a transcript total
 * has one, so it still counts.
 *
 * @param row - The card's row, with its teammates.
 * @returns The reasons, empty when the figures are complete.
 */
export function partialReasons(row: SessionRow): ReadonlySet<PartialReason> {
  const reasons = figureReasons(row)
  if (row.teammates.some((teammate) => sessionUsage(teammate.item).session.tokensPartial)) {
    reasons.add('subagentsExcluded')
  }
  return reasons
}
