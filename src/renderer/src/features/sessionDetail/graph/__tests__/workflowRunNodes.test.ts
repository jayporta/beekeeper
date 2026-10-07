import { describe, expect, it } from 'vitest'
import type { AgentReportDto } from '../../../../../../shared/ipc/agentDto'
import type { WorkflowRunDto } from '../../../../../../shared/ipc/workflowRunDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../../testSessionDetail'
import type { AgentGraphNode } from '../agentGraphNode'
import { buildSubagentNodes } from '../subagentNodes'
import { nodeWorkflows } from '../workflowRunNodes'

const OWNER = testRef(1)

/** A report whose usage is `output` tokens. */
const spent = (output: number): AgentReportDto =>
  testReport({ tokenGroups: [testTokenGroup({ output })] })

/** A record with the given name and no phases, completed unless said otherwise. */
const record = (name: string | null, completed = true): WorkflowRunDto['record'] => ({
  name,
  completed,
  phases: []
})

/** The nodes of a session whose lead has the given children, runs and reports. */
function nodesOf(options: Parameters<typeof testDetail>[0]): readonly AgentGraphNode[] {
  return buildSubagentNodes(testDetail(options), OWNER)
}

const keysOf = (nodes: readonly AgentGraphNode[]): string[] => nodes.map(({ key }) => key)

const runKey = (runId: string): string => `run:${sessionKey(OWNER)}:${runId}`
const agentKey = (agentId: string): string => `sub:${sessionKey(OWNER)}:${agentId}`

describe('buildSubagentNodes workflow runs', () => {
  const children = [
    testNode('a1'),
    testNode('w1', { workflowRunId: 'wf_b' }),
    testNode('w2', { workflowRunId: 'wf_b' }),
    testNode('a3'),
    testNode('w3', { workflowRunId: 'wf_a' })
  ]
  const workflowRuns: WorkflowRunDto[] = [
    { runId: 'wf_a', record: record('alpha') },
    { runId: 'wf_b', record: record('beta') }
  ]

  it('puts the plain subagents first and then one node per run, by run id', () => {
    const nodes = nodesOf({ children, workflowRuns })

    expect(keysOf(nodes)).toEqual([agentKey('a1'), agentKey('a3'), runKey('wf_a'), runKey('wf_b')])
  })

  it('holds a run’s agents under its node in agent order', () => {
    const run = nodesOf({ children, workflowRuns }).find(({ key }) => key === runKey('wf_b'))

    expect(keysOf(run?.children ?? [])).toEqual([agentKey('w1'), agentKey('w2')])
  })

  it('selects a run by its owner and run id', () => {
    const run = nodesOf({ children, workflowRuns })[2]

    expect(run).toMatchObject({
      kind: 'workflow',
      selection: { kind: 'workflow', ownerRef: OWNER, runId: 'wf_a' }
    })
  })

  it('keys a run of a teammate’s session by the teammate’s ref', () => {
    const mate = testRef(2, '-other')

    const nodes = buildSubagentNodes(testDetail({ children, workflowRuns }), mate)

    expect(nodes[2]?.key).toBe(`run:${sessionKey(mate)}:wf_a`)
  })

  it('gives a run and each of its agents the run’s facts, and a plain subagent none', () => {
    const nodes = nodesOf({ children, workflowRuns })
    const run = nodes[3]

    const expected = { runId: 'wf_b', name: 'beta', completed: true, phases: [] }
    expect(run?.workflow).toMatchObject(expected)
    expect(run?.children.map(({ workflow }) => workflow)).toEqual([run?.workflow, run?.workflow])
    expect(nodes[0]?.workflow).toBeNull()
  })

  it('keeps a workflow agent nested under another agent there, with its run’s facts, and builds no run node', () => {
    const nested = testNode('p', { children: [testNode('w9', { workflowRunId: 'wf_a' })] })

    const nodes = nodesOf({ children: [nested], workflowRuns })

    expect(keysOf(nodes)).toEqual([agentKey('p')])
    expect(nodes[0]?.children[0]?.workflow).toMatchObject({ runId: 'wf_a', name: 'alpha' })
  })

  it('names a run for its id, not completed and without phases, when it has no record', () => {
    const nodes = nodesOf({
      children: [testNode('w1', { workflowRunId: 'wf_x' })],
      workflowRuns: [{ runId: 'wf_x', record: null }]
    })

    expect(nodes[0]).toMatchObject({
      name: 'wf_x',
      workflow: { name: 'wf_x', completed: false, phases: [] }
    })
  })

  it('treats a run the detail does not list like one with no record', () => {
    const nodes = nodesOf({ children: [testNode('w1', { workflowRunId: 'wf_x' })] })

    expect(nodes[0]).toMatchObject({ kind: 'workflow', name: 'wf_x' })
  })

  it('names a run for its id when its record has no name', () => {
    const nodes = nodesOf({
      children: [testNode('w1', { workflowRunId: 'wf_x' })],
      workflowRuns: [{ runId: 'wf_x', record: record(null) }]
    })

    expect(nodes[0]?.name).toBe('wf_x')
  })

  it('shows a workflow agent’s own name and type, not the run’s', () => {
    const nodes = nodesOf({
      children: [
        testNode('w1', {
          workflowRunId: 'wf_a',
          meta: testMeta({ name: 'drafter', agentType: 'code' })
        })
      ],
      workflowRuns
    })

    expect(nodes[0]?.children[0]).toMatchObject({ name: 'drafter', agentType: 'code' })
  })
})

describe('buildSubagentNodes run tokens', () => {
  const children = [
    testNode('w1', { workflowRunId: 'wf_a' }),
    testNode('w2', { workflowRunId: 'wf_a' })
  ]
  const workflowRuns: WorkflowRunDto[] = [{ runId: 'wf_a', record: record('alpha') }]

  it('sums its agents’ tokens', () => {
    const [run] = nodesOf({ children, workflowRuns, reports: { w1: spent(10), w2: spent(20) } })

    expect(run).toMatchObject({ tokens: 30, partial: false })
  })

  it('sums what is readable and is partial when one agent’s report is unreadable', () => {
    const [run] = nodesOf({ children, workflowRuns, reports: { w1: spent(10), w2: 'error' } })

    expect(run).toMatchObject({ tokens: 10, partial: true })
  })

  it('has no tokens, and is partial, when every agent’s report is unreadable', () => {
    const [run] = nodesOf({ children, workflowRuns, reports: { w1: 'error', w2: 'error' } })

    expect(run).toMatchObject({ tokens: null, partial: true })
  })

  it('is partial when an agent skipped transcript lines', () => {
    const skipped = testReport({ ...spent(5), skippedLines: 1 })

    const [run] = nodesOf({ children, workflowRuns, reports: { w1: skipped, w2: spent(20) } })

    expect(run).toMatchObject({ tokens: 25, partial: true })
  })

  it('is partial when an agent recorded no tokens', () => {
    const [run] = nodesOf({ children, workflowRuns, reports: { w1: spent(10), w2: testReport() } })

    expect(run).toMatchObject({ tokens: 10, partial: true })
  })
})

describe('nodeWorkflows', () => {
  it('flags the runs that share a name and no others', () => {
    const runs: WorkflowRunDto[] = [
      { runId: 'wf_a', record: record('scan') },
      { runId: 'wf_b', record: record('scan') },
      { runId: 'wf_c', record: record('build') }
    ]

    const workflows = nodeWorkflows(runs)

    expect(
      [...workflows.values()].map(({ runId, duplicateName }) => [runId, duplicateName])
    ).toEqual([
      ['wf_a', true],
      ['wf_b', true],
      ['wf_c', false]
    ])
  })

  it('does not flag runs that are named by their distinct ids', () => {
    const workflows = nodeWorkflows([
      { runId: 'wf_a', record: null },
      { runId: 'wf_b', record: record(null) }
    ])

    expect([...workflows.values()].map(({ duplicateName }) => duplicateName)).toEqual([
      false,
      false
    ])
  })
})
