import type { AgentSignalsDto } from '../ipc/agentDto'
import type { NodeMarks } from './agentGraphNode'

/**
 * The counts a node shows from an agent's signals.
 *
 * @param signals - The agent's signal counts.
 * @returns The tool error and compaction counts, and the longest run of errors.
 */
export function nodeMarks(signals: AgentSignalsDto): NodeMarks {
  return {
    toolErrors: signals.toolErrors,
    compactions: signals.compactions,
    longestErrorStreak: signals.longestErrorStreak
  }
}
