import type { AgentGraphNode, AgentKey } from './agentGraphNode'

/** A graph node with only a key and children, unless overridden. */
export function testGraphNode(
  key: string,
  children: readonly AgentGraphNode[] = [],
  overrides: Partial<AgentGraphNode> = {}
): AgentGraphNode {
  return {
    key: key as AgentKey,
    kind: 'subagent',
    name: key,
    agentType: null,
    model: null,
    tokens: null,
    partial: false,
    stopped: false,
    folder: null,
    selection: null,
    children,
    ...overrides
  }
}
