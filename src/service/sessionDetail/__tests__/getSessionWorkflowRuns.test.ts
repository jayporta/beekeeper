import { describe, expect, it } from 'vitest'
import { getSession } from '../getSession'
import { TEST_PROJECT, TEST_SESSION_ID } from '../../testServiceTree'
import { registerServiceTestTree } from '../../testServiceTree'
import { createWorkflowRunFixtures } from '../../sessions/testWorkflowRuns'

const ctx = registerServiceTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

const { addWorkflowAgent, writeRunRecord } = createWorkflowRunFixtures(ctx)

describe('getSession workflow runs', () => {
  it('sends no runs for a session without workflow agents', async () => {
    const result = await getSession(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([])
  })

  it('sends each run with its record, and tags the run agent in the tree', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await writeRunRecord('wf_a', {
      workflowName: 'scan',
      status: 'completed',
      phases: [{ title: 'Inventory' }]
    })

    const result = await getSession(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([
      { runId: 'wf_a', record: { name: 'scan', completed: true, phases: ['Inventory'] } }
    ])
    const runIds = result.ok
      ? result.value.tree.children.map((c) => [c.agentId, c.workflowRunId])
      : []
    expect(runIds).toEqual([
      ['a1', null],
      ['w1', 'wf_a']
    ])
  })

  it('sends a run with no record file as a run without a record', async () => {
    await addWorkflowAgent('wf_a', 'w1')

    const result = await getSession(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([{ runId: 'wf_a', record: null }])
  })

  it('sends a run whose record is malformed as a run without a record', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await writeRunRecord('wf_a', [])

    const result = await getSession(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([{ runId: 'wf_a', record: null }])
  })

  it('picks up a record that appears after an earlier request cached the scan', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await getSession(ctx.deps, request)
    await writeRunRecord('wf_a', { workflowName: 'scan', status: 'completed' })

    const result = await getSession(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([
      { runId: 'wf_a', record: { name: 'scan', completed: true, phases: [] } }
    ])
  })
})
