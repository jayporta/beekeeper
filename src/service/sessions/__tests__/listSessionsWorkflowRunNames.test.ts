import { describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { listSessions } from '../listSessions'
import { TEST_PROJECT, TEST_SESSION_ID, registerServiceTestTree } from '../../testServiceTree'
import { createWorkflowRunFixtures } from '../testWorkflowRuns'

const ctx = registerServiceTestTree()
const { addWorkflowAgent, writeRunRecord } = createWorkflowRunFixtures(ctx)

async function listItem(): Promise<SessionListItemDto> {
  const result = await listSessions(ctx.deps, { projectDirName: TEST_PROJECT })
  const item = result.ok ? result.value.find((entry) => entry.sessionId === TEST_SESSION_ID) : null
  if (item === null || item === undefined) throw new Error('The session was not listed')
  return item
}

describe('listSessions workflow run names', () => {
  it('sends the name of a run whose record has one', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await writeRunRecord('wf_a', { workflowName: 'scan', status: 'completed' })

    expect((await listItem()).workflowRunNames).toEqual(['scan'])
  })

  it('sends no names for a session without workflow runs', async () => {
    expect((await listItem()).workflowRunNames).toEqual([])
  })

  it('lists a session whose run has no record yet, without a name', async () => {
    await addWorkflowAgent('wf_a', 'w1')

    const item = await listItem()

    expect(item.workflowRunNames).toEqual([])
    expect(item.summary.ok).toBe(true)
  })

  it('picks up a record written after an earlier listing', async () => {
    await addWorkflowAgent('wf_a', 'w1')
    await listItem()
    await writeRunRecord('wf_a', { workflowName: 'scan', status: 'completed' })

    expect((await listItem()).workflowRunNames).toEqual(['scan'])
  })
})
