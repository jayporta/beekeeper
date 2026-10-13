import type { AgentGraphNode, AgentKey } from './agentGraphNode'

/** A graph node with only a key and no children, unless overridden. */
export function testGraphNode(
  key: string,
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
    marks: null,
    subagentsNotLoaded: false,
    folder: null,
    selection: null,
    workflow: null,
    children: [],
    ...overrides
  }
}
