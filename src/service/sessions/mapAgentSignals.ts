import type { AgentSignals } from '../../core/transcript/signals/agentSignals'
import type { AgentSignalsDto } from '../../shared/ipc/agentDto'

/**
 * Maps an agent's signal counts onto their transfer shape, field by field, so
 * no unknown field crosses the bridge.
 *
 * @param signals - The core signals.
 * @returns The DTO, with the longest wait copied as a new object.
 */
export function mapAgentSignals(signals: AgentSignals): AgentSignalsDto {
  return {
    toolErrors: signals.toolErrors,
    longestErrorStreak: signals.longestErrorStreak,
    longestBashRepeat: signals.longestBashRepeat,
    compactions: signals.compactions,
    agentsKilled: signals.agentsKilled,
    longestToolWait:
      signals.longestToolWait === null
        ? null
        : { ms: signals.longestToolWait.ms, tool: signals.longestToolWait.tool },
    partial: signals.partial
  }
}
