import { describe, expect, it } from 'vitest'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import { toAgentId } from '../../../core/transcript/ids'
import { parseWorkflowRunId } from '../../../core/transcript/workflowRunId'
import { distinctRunIds } from '../distinctRunIds'

/** A subagent entry in the given run, or directly in `subagents/` for `null`. */
function entry(agentId: string, runId: string | null): SubagentEntry {
  return {
    agentId: toAgentId(agentId),
    transcript: { path: `/unused/agent-${agentId}.jsonl`, mtimeMs: 1, size: 1 },
    metaPath: null,
    workflowRunId: runId === null ? null : parseWorkflowRunId(runId)
  }
}

describe('distinctRunIds', () => {
  it('collapses subagents of the same run into one id', () => {
    expect(distinctRunIds([entry('x', 'wf_a'), entry('y', 'wf_a')])).toEqual(['wf_a'])
  })

  it('skips subagents that are not in a run', () => {
    expect(distinctRunIds([entry('x', null), entry('y', 'wf_a')])).toEqual(['wf_a'])
  })

  it('orders the ids by code unit, whatever order the subagents come in', () => {
    expect(distinctRunIds([entry('x', 'wf_b'), entry('y', 'wf_B'), entry('z', 'wf_a')])).toEqual([
      'wf_B',
      'wf_a',
      'wf_b'
    ])
  })

  it('returns no ids for no subagents', () => {
    expect(distinctRunIds([])).toEqual([])
  })
})
