import type { AgentCountWords } from './agentCountLabel'

const plural = (count: number, one: string, other: string): string =>
  `${count} ${count === 1 ? one : other}`

/** English agent count words, for tests of the shared session code. */
export const testAgentCountWords: AgentCountWords = {
  teammates: (count) => plural(count, 'teammate', 'teammates'),
  subagents: (count) => plural(count, 'subagent', 'subagents'),
  workflows: (count, agents) => `${plural(count, 'workflow', 'workflows')} (${agents})`,
  workflowAgents: (count) => plural(count, 'agent', 'agents'),
  separator: ', ',
  none: 'None'
}
