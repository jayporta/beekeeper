import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import type { SignalTotalsDto } from '../../../../shared/ipc/sessionTeamDto'
import type { SessionsT } from './sessionsT'

/**
 * The signal counts a session's card shows: a lead with teammates shows its
 * team's totals, and any other session shows its own.
 *
 * @param item - A session list item.
 * @returns The counts, or `null` when the session's summary couldn't be read.
 */
export function signalTotalsOf(item: SessionListItemDto): SignalTotalsDto | null {
  if (item.team?.kind === 'lead') return item.team.usage.signalTotals
  if (!item.summary.ok) return null
  const { toolErrors, compactions, agentsKilled } = item.summary.value.signals
  return { toolErrors, compactions, agentsKilled }
}

/**
 * Whether any count is above zero.
 *
 * @param totals - The counts from {@link signalTotalsOf}, or `null` for none.
 * @returns `true` when at least one count is nonzero.
 */
export function hasSignalCounts(totals: SignalTotalsDto | null): boolean {
  return (
    totals !== null && (totals.toolErrors > 0 || totals.compactions > 0 || totals.agentsKilled > 0)
  )
}

/**
 * The muted notes for a card's signal counts.
 *
 * @param totals - The counts from {@link signalTotalsOf}, or `null` for none.
 * @param t - The sessions translate function.
 * @returns A note for each nonzero count, in the order tool errors,
 * compactions, agent kills. For example `12 tool errors`.
 */
export function signalNotes(totals: SignalTotalsDto | null, t: SessionsT): string[] {
  if (totals === null) return []
  const notes: string[] = []
  if (totals.toolErrors > 0) notes.push(t('notes.toolErrors', { count: totals.toolErrors }))
  if (totals.compactions > 0) notes.push(t('notes.compactions', { count: totals.compactions }))
  if (totals.agentsKilled > 0) notes.push(t('notes.agentKills', { count: totals.agentsKilled }))
  return notes
}
