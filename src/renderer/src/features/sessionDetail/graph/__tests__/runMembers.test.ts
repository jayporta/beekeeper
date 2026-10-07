import { describe, expect, it } from 'vitest'
import { testGraphNode } from '../testGraphNode'
import { runMembers } from '../runMembers'
import type { AgentGraphNode, NodeWorkflow } from '../agentGraphNode'

const workflowOf = (runId: string): NodeWorkflow => ({
  runId,
  name: runId,
  completed: true,
  duplicateName: false,
  phases: []
})

/** A subagent node in the run, or in no run when `runId` is `null`. */
const agent = (
  key: string,
  runId: string | null,
  children: readonly AgentGraphNode[] = []
): AgentGraphNode =>
  testGraphNode(key, { workflow: runId === null ? null : workflowOf(runId), children })

const keysOf = (nodes: readonly AgentGraphNode[]): string[] => nodes.map(({ key }) => key)

describe('runMembers', () => {
  it('returns no members for no agents', () => {
    expect(runMembers([], 'wf_a')).toEqual([])
  })

  it('returns the agents of the run at the top, in order', () => {
    const agents = [agent('w1', 'wf_a'), agent('w2', 'wf_a')]

    expect(keysOf(runMembers(agents, 'wf_a'))).toEqual(['w1', 'w2'])
  })

  it('returns a member nested under another member, after its parent', () => {
    const agents = [agent('w1', 'wf_a', [agent('w2', 'wf_a')]), agent('w3', 'wf_a')]

    expect(keysOf(runMembers(agents, 'wf_a'))).toEqual(['w1', 'w2', 'w3'])
  })

  it('returns a member nested under an agent that is not in the run', () => {
    const agents = [agent('w1', 'wf_a', [agent('plain', null, [agent('w2', 'wf_a')])])]

    expect(keysOf(runMembers(agents, 'wf_a'))).toEqual(['w1', 'w2'])
  })

  it('leaves out agents with no run or another run', () => {
    const agents = [agent('w1', 'wf_a', [agent('plain', null), agent('other', 'wf_b')])]

    expect(keysOf(runMembers(agents, 'wf_a'))).toEqual(['w1'])
  })

  it('walks a spawn chain thousands deep without overflowing the stack', () => {
    let chain = agent('leaf', 'wf_a')
    for (let i = 0; i < 20_000; i += 1) chain = agent(`n${i}`, 'wf_a', [chain])

    expect(runMembers([chain], 'wf_a')).toHaveLength(20_001)
  })
})
