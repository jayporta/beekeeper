import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import { reportTokens } from '../graph/reportFacts'
import type { ReportCost } from './reportCost'
import type { Rollup } from './rollupBelow'

/** Why a figure in the inspector may be lower than the truth. */
export type InspectorReason =
  | 'unreadableLines'
  | 'unpricedTokens'
  | 'incompleteFiles'
  | 'incompleteSignals'
  | 'unrecordedTokens'
  | 'subagentsUnreadable'
  | 'subagentsNotLoaded'
  | 'belowIncomplete'
  | 'workflowAgentsIncomplete'
  | 'other'

/** What {@link inspectorReasons} reads. */
interface InspectorReasonsInput {
  /** The agent's report. */
  readonly report: AgentReportDto
  /** The agent's cost. */
  readonly cost: ReportCost
  /** What the agents below add up to. */
  readonly rollup: Rollup
  /** Whether the agent's graph node is marked partial, for a reason the figures above don't name. */
  readonly partial: boolean
  /** Whether the session's subagents folder couldn't be read, so agents below may be missing. */
  readonly subagentsUnreadable: boolean
}

/**
 * Works out why the inspector's figures may leave something out, so its
 * footnote can explain each "¹" on screen.
 *
 * @param input - The agent's report, cost, rollup, partial mark, and whether its subagents were unreadable.
 * @returns The reasons, empty when every figure is whole.
 */
export function inspectorReasons({
  report,
  cost,
  rollup,
  partial,
  subagentsUnreadable
}: InspectorReasonsInput): ReadonlySet<InspectorReason> {
  const reasons = new Set<InspectorReason>()
  if (report.skippedLines > 0) reasons.add('unreadableLines')
  if (cost.partial) reasons.add('unpricedTokens')
  if (report.fileListIncomplete) reasons.add('incompleteFiles')
  if (report.signals.partial) reasons.add('incompleteSignals')
  if (rollup.below > 0 && reportTokens(report) === null) reasons.add('unrecordedTokens')
  if (subagentsUnreadable) reasons.add('subagentsUnreadable')
  if (rollup.subagentsNotLoaded) reasons.add('subagentsNotLoaded')
  if (rollup.incomplete) reasons.add('belowIncomplete')
  if (partial && reasons.size === 0) reasons.add('other')
  return reasons
}
