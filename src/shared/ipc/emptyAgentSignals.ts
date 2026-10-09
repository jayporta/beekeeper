import type { AgentSignalsDto } from './agentDto'

/** The signals of an agent with none: all counts zero, no wait, and not partial. */
export const EMPTY_AGENT_SIGNALS_DTO: AgentSignalsDto = {
  toolErrors: 0,
  longestErrorStreak: 0,
  longestBashRepeat: 0,
  compactions: 0,
  agentsKilled: 0,
  longestToolWait: null,
  partial: false
}
