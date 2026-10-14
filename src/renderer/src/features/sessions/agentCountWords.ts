import type { AgentCountWords } from '../../../../shared/sessions/agentCountLabel'
import type { SessionsT } from './sessionsT'

/**
 * The agent count words in the UI language.
 *
 * @param t - The sessions translate function.
 * @returns The words `agentCountLabel` describes a session's agents with.
 */
export function agentCountWords(t: SessionsT): AgentCountWords {
  return {
    teammates: (count) => t('agents.teammates', { count }),
    subagents: (count) => t('agents.subagents', { count }),
    workflows: (count, agents) => t('agents.workflows', { count, agents }),
    workflowAgents: (count) => t('agents.workflowAgents', { count }),
    separator: t('agents.separator'),
    none: t('agents.none')
  }
}
