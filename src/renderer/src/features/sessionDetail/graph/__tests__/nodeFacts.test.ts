import { describe, expect, it } from 'vitest'
import type { NodeWorkflow } from '../agentGraphNode'
import { testGraphNode } from '../testGraphNode'
import { testGraphT } from '../testGraphT'
import { nodeAccessibleName, nodeDetail } from '../nodeFacts'

const nameOf = (
  overrides: Parameters<typeof testGraphNode>[1],
  { loading = false, parent = null }: { loading?: boolean; parent?: string | null } = {}
): string =>
  nodeAccessibleName(testGraphNode('lead', { name: 'Lead', kind: 'lead', ...overrides }), {
    t: testGraphT,
    loading,
    parent
  })

describe('nodeDetail', () => {
  it('is the type and the model', () => {
    const node = testGraphNode('a', { agentType: 'Explore', model: 'claude-haiku-5' })

    expect(nodeDetail(node, testGraphT)).toEqual(['Explore', 'claude-haiku-5'])
  })

  it('leaves out a type or model that is unknown', () => {
    expect(nodeDetail(testGraphNode('a', { model: 'claude-haiku-5' }), testGraphT)).toEqual([
      'claude-haiku-5'
    ])
    expect(nodeDetail(testGraphNode('a'), testGraphT)).toEqual([])
  })

  it('is the folder, not the type and model, for a teammate in another folder', () => {
    const node = testGraphNode('a', { agentType: 'code', model: 'm', folder: '-Users-a-other' })

    expect(nodeDetail(node, testGraphT)).toEqual(['in -Users-a-other'])
  })
})

/** A run node's facts: three phases unless overridden. */
const runWorkflow = (overrides: Partial<NodeWorkflow> = {}): NodeWorkflow => ({
  runId: 'wf_b',
  name: 'scan',
  completed: true,
  duplicateName: false,
  phases: ['plan', 'scan', 'report'],
  ...overrides
})

describe('nodeDetail a workflow run', () => {
  it('is the kind word and the phase count', () => {
    const node = testGraphNode('run', { kind: 'workflow', workflow: runWorkflow() })

    expect(nodeDetail(node, testGraphT)).toEqual(['workflow', '3 phases'])
  })

  it('counts one phase in the singular', () => {
    const node = testGraphNode('run', {
      kind: 'workflow',
      workflow: runWorkflow({ phases: ['plan'] })
    })

    expect(nodeDetail(node, testGraphT)).toEqual(['workflow', '1 phase'])
  })

  it('is only the kind word when the run has no phases', () => {
    const node = testGraphNode('run', { kind: 'workflow', workflow: runWorkflow({ phases: [] }) })

    expect(nodeDetail(node, testGraphT)).toEqual(['workflow'])
  })

  it('is the run id instead of the phase count when another run has the same name, so the id fits', () => {
    const node = testGraphNode('run', {
      kind: 'workflow',
      workflow: runWorkflow({ duplicateName: true })
    })

    expect(nodeDetail(node, testGraphT)).toEqual(['workflow', 'wf_b'])
  })
})

describe('nodeAccessibleName a workflow run', () => {
  const run = (workflow = runWorkflow()): Parameters<typeof testGraphNode>[1] => ({
    kind: 'workflow',
    name: workflow.name,
    tokens: 635000,
    workflow,
    children: Array.from({ length: 8 }, (_, i) => testGraphNode(`w${i}`, { workflow }))
  })

  it('gives the kind once, then tokens, phases and the agent count', () => {
    expect(nameOf(run(), { parent: 'Lead' })).toBe(
      'scan, workflow of Lead, 635K tokens, 3 phases, 8 agents'
    )
  })

  it('adds the run id when another run has the same name', () => {
    expect(nameOf(run(runWorkflow({ duplicateName: true })), { parent: 'Lead' })).toBe(
      'scan, workflow of Lead, 635K tokens, 3 phases, wf_b, 8 agents'
    )
  })

  it('counts one agent in the singular and leaves out phases a run lacks', () => {
    const workflow = runWorkflow({ phases: [] })
    const lone = { ...run(workflow), children: [testGraphNode('w1', { workflow })] }

    expect(nameOf(lone, { parent: 'Lead' })).toBe('scan, workflow of Lead, 635K tokens, 1 agent')
  })

  it('counts a member nested under another agent, but not a nested agent outside the run', () => {
    const workflow = runWorkflow({ phases: [] })
    const nested = testGraphNode('w2', { workflow })
    const outsider = testGraphNode('s1', { workflow: null, children: [nested] })
    const parent = testGraphNode('w1', { workflow, children: [outsider] })

    expect(nameOf({ ...run(workflow), children: [parent] }, { parent: 'Lead' })).toBe(
      'scan, workflow of Lead, 635K tokens, 2 agents'
    )
  })

  it('names the flags last', () => {
    expect(nameOf({ ...run(), partial: true }, { parent: 'Lead' })).toBe(
      'scan, workflow of Lead, 635K tokens, 3 phases, 8 agents, partial data'
    )
  })
})

describe('nodeAccessibleName', () => {
  it('gives the name, kind, tokens, then type and model', () => {
    const label = nameOf({ tokens: 1500, agentType: 'Explore', model: 'claude-haiku-5' })

    expect(label).toBe('Lead, lead, 1.5K tokens, Explore, claude-haiku-5')
  })

  it('names the kind of a teammate and of a subagent', () => {
    expect(nameOf({ kind: 'teammate', tokens: 1 })).toBe('Lead, teammate, 1 token')
    expect(nameOf({ kind: 'subagent', tokens: 1 })).toBe('Lead, subagent, 1 token')
  })

  it('says tokens are not recorded when there are none to show', () => {
    expect(nameOf({ tokens: null })).toBe('Lead, lead, tokens not recorded')
  })

  it('counts zero tokens', () => {
    expect(nameOf({ tokens: 0 })).toBe('Lead, lead, 0 tokens')
  })

  it('names the parent after the kind, so same-named siblings still read apart by where they hang', () => {
    expect(nameOf({ kind: 'subagent', tokens: 1 }, { parent: 'Lead' })).toBe(
      'Lead, subagent of Lead, 1 token'
    )
    expect(nameOf({ kind: 'teammate', tokens: 1, model: 'm' }, { parent: 'a, b' })).toBe(
      'Lead, teammate of a, b, 1 token, m'
    )
  })

  it('leaves the root’s name as it was', () => {
    expect(nameOf({ tokens: 1 })).toBe('Lead, lead, 1 token')
  })

  it('names the flags last', () => {
    const label = nameOf({ tokens: 5, model: 'm', stopped: true, partial: true })

    expect(label).toBe('Lead, lead, 5 tokens, m, stopped, partial data')
  })

  it('says a teammate is still loading its subagents, after the stopped flag', () => {
    expect(nameOf({ kind: 'teammate', tokens: 5, stopped: true }, { loading: true })).toBe(
      'Lead, teammate, 5 tokens, stopped, loading subagents'
    )
  })

  it('names the folder of a teammate in another folder', () => {
    expect(nameOf({ kind: 'teammate', tokens: 5, folder: '-other' })).toBe(
      'Lead, teammate, 5 tokens, in -other'
    )
  })
})

describe('nodeAccessibleName marks', () => {
  it('says the counts in words, before the stopped flag', () => {
    const name = nameOf({ marks: { toolErrors: 12, compactions: 1 }, stopped: true })

    expect(name).toContain('12 tool errors, 1 compaction, stopped')
  })

  it('leaves out a count that is zero', () => {
    const name = nameOf({ marks: { toolErrors: 1, compactions: 0 } })

    expect(name).toContain('1 tool error')
    expect(name).not.toContain('compaction')
  })

  it('does not read the mark glyphs', () => {
    expect(nameOf({ marks: { toolErrors: 12, compactions: 2 } })).not.toMatch(/[×▲]/)
  })
})
