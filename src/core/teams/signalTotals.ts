import type { SummarizedSession } from './teamGrouping'

/** The signal counts that add across a team, since a team has no single streak or wait. */
export interface SignalTotals {
  /** Tool results with `is_error: true`, summed over the sessions. */
  readonly toolErrors: number
  /** Context compactions, summed over the sessions. */
  readonly compactions: number
  /** Agent kills, summed over the sessions. */
  readonly agentsKilled: number
  /** Whether any summed session's signals are partial, because its transcript hit the per-transcript event cap. */
  readonly partial: boolean
}

/**
 * Sums the countable signals over sessions.
 *
 * @param sessions - The sessions to total, such as a lead and its teammates.
 * @returns The totals. Zero for each count when `sessions` is empty.
 */
export function sumSignalTotals(sessions: readonly SummarizedSession[]): SignalTotals {
  let toolErrors = 0
  let compactions = 0
  let agentsKilled = 0
  let partial = false
  for (const { summary } of sessions) {
    toolErrors += summary.signals.toolErrors
    compactions += summary.signals.compactions
    agentsKilled += summary.signals.agentsKilled
    partial ||= summary.signals.partial
  }
  return { toolErrors, compactions, agentsKilled, partial }
}
