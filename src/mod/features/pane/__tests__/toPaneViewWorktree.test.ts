import { describe, expect, it } from 'vitest'
import { testDetail, testMeta, testNode } from '../../../../shared/agentGraph/testSessionDetail'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../../../../shared/sessions/testSessionFixtures'
import type { PaneNode } from '../paneView'
import { refreshPane } from '../refreshPane'
import { testPaneServices } from '../../shared/testPaneServices'

const REF = testRef(1)

async function rootOf(
  detail: ReturnType<typeof testDetail>,
  sessions = [testSession(1, { title: 'Fix the bug' })]
): Promise<PaneNode | null> {
  const services = testPaneServices({
    list: { ok: true, value: sessions },
    get: { ok: true, value: detail }
  })
  const { view } = await refreshPane(services, {
    ref: REF,
    withList: true,
    lastItems: null,
    nowMs: 1,
    target: 'current'
  })
  return view.root
}

describe('worktree facts on pane nodes', () => {
  it('gives a subagent on a worktree branch its owner ref, agent id and branch', async () => {
    const root = await rootOf(
      testDetail({ children: [testNode('a1', { meta: testMeta({ worktreeBranch: 'feat/x' }) })] })
    )

    expect(root?.children[0]?.worktree).toEqual({
      projectDirName: REF.projectDirName,
      sessionId: REF.sessionId,
      agentId: 'a1',
      branch: 'feat/x'
    })
  })

  it('gives a subagent without a worktree branch, and the lead, none', async () => {
    const root = await rootOf(testDetail({ children: [testNode('a1')] }))

    expect(root?.worktree).toBeNull()
    expect(root?.children[0]?.worktree).toBeNull()
  })

  it('gives a teammate and a workflow run none', async () => {
    const withTeam = testSession(1, { title: 'Lead', team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(REF)
    })
    const root = await rootOf(
      testDetail({
        children: [
          testNode('w1', { workflowRunId: 'wf_a', meta: testMeta({ worktreeBranch: 'b' }) })
        ],
        workflowRuns: [{ runId: 'wf_a', record: { name: 'flow', completed: true, phases: [] } }]
      }),
      [withTeam, mate]
    )

    expect(root?.children.map((child) => [child.kind, child.worktree])).toEqual([
      ['workflow', null],
      ['teammate', null]
    ])
  })

  it('cleans control characters out of the branch', async () => {
    const root = await rootOf(
      testDetail({
        children: [testNode('a1', { meta: testMeta({ worktreeBranch: 'feat/\u001b[31mx' }) })]
      })
    )

    expect(root?.children[0]?.worktree?.branch).not.toContain('\u001b')
  })
})
