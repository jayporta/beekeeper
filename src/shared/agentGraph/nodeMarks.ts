import type { AgentSignalsDto } from '../ipc/agentDto'
import type { NodeMarks } from './agentGraphNode'

/**
 * The counts a node shows from an agent's signals.
 *
 * @param signals - The agent's signal counts.
 * @returns The tool error and compaction counts.
 */
export function nodeMarks(signals: AgentSignalsDto): NodeMarks {
  return { toolErrors: signals.toolErrors, compactions: signals.compactions }
}

/**
 * Whether a node shows any mark.
 *
 * @param marks - The node's marks, or `null` when they aren't known.
 * @returns `true` when a count is above zero.
 */
export function hasMarks(marks: NodeMarks | null): boolean {
  return marks !== null && (marks.toolErrors > 0 || marks.compactions > 0)
}
