import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAssistantRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { getSessionHandler } from '../getSessionHandler'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

/** Writes a workflow agent's transcript into a run folder of the test session. */
async function addWorkflowAgent(runId: string, agentId: string): Promise<void> {
  const runDir = join(
    dirname(ctx.tree.sessionPath),
    TEST_SESSION_ID,
    'subagents',
    'workflows',
    runId
  )
  await mkdir(runDir, { recursive: true })
  await writeFile(
    join(runDir, `agent-${agentId}.jsonl`),
    buildJsonlText([buildAssistantRecord({ messageId: `msg_${agentId}` })])
  )
}

/** Writes a workflow run's record file in the test session. */
async function writeRunRecord(runId: string, record: unknown): Promise<void> {
  const workflowsDir = join(dirname(ctx.tree.sessionPath), TEST_SESSION_ID, 'workflows')
  await mkdir(workflowsDir, { recursive: true })
  await writeFile(join(workflowsDir, `${runId}.json`), JSON.stringify(record))
}

describe('getSessionHandler workflow runs', () => {
  it('sends no runs for a session without workflow agents', async () => {
    const result = await getSessionHandler(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([])
  })

  it('sends each run with its record, and tags the run agent in the tree', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await writeRunRecord('wf_a', {
      workflowName: 'scan',
      status: 'completed',
      phases: [{ title: 'Inventory' }]
    })

    const result = await getSessionHandler(ctx.deps, request)

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

    const result = await getSessionHandler(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([{ runId: 'wf_a', record: null }])
  })

  it('sends a run whose record is malformed as a run without a record', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await writeRunRecord('wf_a', [])

    const result = await getSessionHandler(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([{ runId: 'wf_a', record: null }])
  })

  it('picks up a record that appears after an earlier request cached the scan', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await getSessionHandler(ctx.deps, request)
    await writeRunRecord('wf_a', { workflowName: 'scan', status: 'completed' })

    const result = await getSessionHandler(ctx.deps, request)

    expect(result.ok && result.value.workflowRuns).toEqual([
      { runId: 'wf_a', record: { name: 'scan', completed: true, phases: [] } }
    ])
  })
})
