import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { toAgentId } from '../../../core/transcript/ids'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import { buildDiscoveryTree, type DiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { parseWorkflowRunId } from '../../../core/transcript/workflowRunId'
import { readWorkflowRuns } from '../readWorkflowRuns'

let tree: DiscoveryTree | undefined

afterEach(async () => {
  await tree?.cleanup()
  tree = undefined
})

/** A subagent entry in the given run, or directly in `subagents/` for `null`. */
function entry(agentId: string, runId: string | null): SubagentEntry {
  return {
    agentId: toAgentId(agentId),
    transcript: { path: `/unused/agent-${agentId}.jsonl`, mtimeMs: 1, size: 1 },
    metaPath: null,
    workflowRunId: runId === null ? null : parseWorkflowRunId(runId)
  }
}

describe('readWorkflowRuns', () => {
  it('reads one run per distinct run id, in run id order', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/workflows/wf_a.json': '{"workflowName":"alpha","status":"completed"}',
        'session/workflows/wf_b.json': '{"workflowName":"beta","phases":[{"title":"P1"}]}'
      }
    })

    const runs = await readWorkflowRuns(join(tree.root, 'session'), [
      entry('x', 'wf_b'),
      entry('y', 'wf_a'),
      entry('z', 'wf_b')
    ])

    expect(runs).toEqual([
      { runId: 'wf_a', record: { name: 'alpha', completed: true, phases: [] } },
      { runId: 'wf_b', record: { name: 'beta', completed: false, phases: ['P1'] } }
    ])
  })

  it('gives a run with no record file a null record', async () => {
    tree = await buildDiscoveryTree({})

    const runs = await readWorkflowRuns(join(tree.root, 'session'), [entry('x', 'wf_a')])

    expect(runs).toEqual([{ runId: 'wf_a', record: null }])
  })

  it('gives a run whose record is malformed a null record, leaving other runs intact', async () => {
    tree = await buildDiscoveryTree({
      files: {
        'session/workflows/wf_a.json': '{',
        'session/workflows/wf_b.json': '{"workflowName":"beta"}'
      }
    })

    const runs = await readWorkflowRuns(join(tree.root, 'session'), [
      entry('x', 'wf_a'),
      entry('y', 'wf_b')
    ])

    expect(runs.map((r) => [r.runId, r.record?.name ?? null])).toEqual([
      ['wf_a', null],
      ['wf_b', 'beta']
    ])
  })

  it.skipIf(process.getuid?.() === 0)(
    'gives a run whose record cannot be opened a null record instead of failing',
    async () => {
      tree = await buildDiscoveryTree({
        files: { 'session/workflows/wf_a.json': '{"workflowName":"alpha"}' }
      })
      const path = join(tree.root, 'session', 'workflows', 'wf_a.json')
      await chmod(path, 0o000)

      try {
        const runs = await readWorkflowRuns(join(tree.root, 'session'), [entry('x', 'wf_a')])

        expect(runs).toEqual([{ runId: 'wf_a', record: null }])
      } finally {
        await chmod(path, 0o600)
      }
    }
  )

  it('returns no runs when no entry is in a run', async () => {
    tree = await buildDiscoveryTree({})

    expect(await readWorkflowRuns(join(tree.root, 'session'), [entry('x', null)])).toEqual([])
  })

  it('returns no runs for no entries', async () => {
    tree = await buildDiscoveryTree({})

    expect(await readWorkflowRuns(join(tree.root, 'session'), [])).toEqual([])
  })
})
