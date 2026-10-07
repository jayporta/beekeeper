import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../../shared/ipc/sessionDetailDto'
import type { WorkflowRunDto } from '../../../../../../shared/ipc/workflowRunDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { SCENE_SESSION } from '../../graph/testGraphScene'
import { testGraphNode } from '../../graph/testGraphNode'
import { InspectedWorkflow } from '../InspectedWorkflow'
import { testDetail, testMeta, testNode, testReport } from '../../testSessionDetail'
import { SCENE_START, inspector, pricedGroup, renderInspectorScene } from '../testInspectorScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

const MIN = 60_000

const RUN: WorkflowRunDto = {
  runId: 'wf_a',
  record: { name: 'scan', completed: true, phases: ['plan', 'execute', 'report'] }
}

const children = [
  testNode('w1', { workflowRunId: 'wf_a', meta: testMeta({ name: 'drafter' }) }),
  testNode('w2', { workflowRunId: 'wf_a', meta: testMeta({ name: 'checker' }) })
]

const reports = {
  w1: testReport({
    tokenGroups: [pricedGroup({ output: 10 })],
    messageCount: 3,
    activity: { earliestMs: SCENE_START, latestMs: SCENE_START + 10 * MIN },
    fileTouches: [{ filePath: '/repo/a.ts', operation: 'edit', source: 'edit-write' }]
  }),
  w2: testReport({
    tokenGroups: [pricedGroup({ input: 20 })],
    messageCount: 2,
    activity: { earliestMs: SCENE_START + 5 * MIN, latestMs: SCENE_START + 30 * MIN }
  })
}

/** Renders the scene with the run `wf_a` and selects its node. */
async function openRun(
  options: { workflowRuns?: readonly WorkflowRunDto[]; reports?: typeof reports } = {}
): Promise<void> {
  const detail = testDetail({
    children,
    reports: options.reports ?? reports,
    workflowRuns: options.workflowRuns ?? [RUN]
  })
  renderInspectorScene({ detail })
  await userEvent.click(screen.getByRole('button', { name: /^scan, workflow|^wf_a, workflow/ }))
}

describe('AgentInspector for a workflow run', () => {
  it('says it is a completed workflow and names the run as the heading', async () => {
    await openRun()

    expect(inspector().getByText('Workflow · completed')).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 2, name: 'scan' })).toBeTruthy()
  })

  it('shows the run id, how long it ran and how many messages it sent', async () => {
    await openRun()

    expect(inspector().getByText(/5 messages/).textContent).toMatch(
      /wf_a\s*·\s*30m\s*·\s*5 messages/
    )
  })

  it('shows the run’s tokens, its agent count and its cost', async () => {
    await openRun()

    expect(inspector().getByText('30 tokens')).toBeTruthy()
    expect(inspector().getByText('2 agents')).toBeTruthy()
    expect(inspector().getByText('$5.00 at API prices')).toBeTruthy()
  })

  it('does not add the agents’ tokens to the run’s again', async () => {
    await openRun()

    expect(inspector().queryByText(/incl\./)).toBeNull()
  })

  it('lists the phases in order under a heading', async () => {
    await openRun()

    const section = inspector()
      .getByRole('heading', { level: 3, name: 'Phases' })
      .closest('section')
    const items = [...(section?.querySelectorAll('li') ?? [])].map((li) => li.textContent)

    expect(items).toEqual(['plan', 'execute', 'report'])
  })

  it('shows tokens by class over every agent', async () => {
    await openRun()

    expect(inspector().getByRole('heading', { level: 3, name: 'Tokens · 30 tokens' })).toBeTruthy()
    expect(inspector().getByText('Input').closest('li')?.textContent).toBe('Input20')
    expect(inspector().getByText('Output').closest('li')?.textContent).toBe('Output10')
  })

  it('shows no files, though an agent touched one', async () => {
    await openRun()

    expect(inspector().queryByText(/Files touched/)).toBeNull()
    expect(inspector().queryByText('/repo/a.ts')).toBeNull()
  })

  it('names the run by its id, with no phases, when it has no record', async () => {
    await openRun({ workflowRuns: [{ runId: 'wf_a', record: null }] })

    expect(inspector().getByRole('heading', { level: 2, name: 'wf_a' })).toBeTruthy()
    expect(inspector().getByText('Workflow')).toBeTruthy()
    expect(inspector().queryByRole('heading', { name: 'Phases' })).toBeNull()
  })

  it('renders a phase title as plain text, isolated from the text around it', async () => {
    await openRun({
      workflowRuns: [
        { runId: 'wf_a', record: { name: 'scan', completed: true, phases: ['<b>x</b>'] } }
      ]
    })

    expect(inspector().getByText('<b>x</b>').tagName).toBe('BDI')
  })

  it('has no flags or footnote when every agent’s data is whole', async () => {
    await openRun()

    expect(inspector().queryByText(/Partial/)).toBeNull()
  })

  it('marks the cost and names unpriced tokens in the footnote when a group has no known price', async () => {
    await openRun({
      reports: {
        ...reports,
        w2: testReport({
          tokenGroups: [pricedGroup({ input: 20 }, { kind: 'unpriced', reason: 'unknown-model' })]
        })
      }
    })

    expect(inspector().getByText(/at API prices/).textContent).toContain('¹')
    expect(inspector().getByText(/Some tokens have no known price/)).toBeTruthy()
  })

  it('is partial, with the readable sum, when one agent’s report is unreadable', async () => {
    const detail = testDetail({
      children,
      reports: { w1: reports.w1, w2: 'error' },
      workflowRuns: [RUN]
    })
    renderInspectorScene({ detail })
    await userEvent.click(screen.getByRole('button', { name: /^scan, workflow/ }))

    expect(inspector().getByText(/^10 tokens/).textContent).toContain('¹')
    expect(inspector().getByText(/^¹ Partial:/)).toBeTruthy()
  })

  it('is not partial for an incomplete file list alone, since a run shows no files', async () => {
    await openRun({
      reports: { ...reports, w1: { ...reports.w1, fileListIncomplete: true } }
    })

    expect(inspector().queryByText(/Partial/)).toBeNull()
    expect(inspector().getByText(/^30 tokens/).textContent).not.toContain('¹')
  })

  it('is partial when an agent recorded no tokens', async () => {
    await openRun({ reports: { ...reports, w2: testReport() } })

    expect(inspector().getByText(/^10 tokens/).textContent).toContain('¹')
  })
})

describe('InspectedWorkflow without its session’s detail', () => {
  const node = testGraphNode('run:x', {
    kind: 'workflow',
    name: 'scan',
    workflow: { runId: 'wf_a', name: 'scan', completed: true, duplicateName: false, phases: [] }
  })
  const renderRun = (getSession: () => Promise<IpcResult<SessionDetailDto>>): void => {
    installBeekeeperApi({ getSession })
    render(<InspectedWorkflow node={node} ownerRef={SCENE_SESSION} />, {
      wrapper: createQueryWrapper()
    })
  }

  it('says it is loading, politely, while the detail loads', async () => {
    renderRun(() => new Promise(() => undefined))

    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Loading this workflow')
    expect(screen.getByRole('heading', { level: 2, name: 'scan' })).toBeTruthy()
  })

  it('says it cannot read the run when the detail failed to load', async () => {
    renderRun(() => Promise.resolve({ ok: false, error: { code: 'unreadable' } }))

    expect(await screen.findByText("beekeeper couldn't read this workflow's agents.")).toBeTruthy()
  })
})
