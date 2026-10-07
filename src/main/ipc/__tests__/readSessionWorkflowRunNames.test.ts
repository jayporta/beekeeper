import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import { toAgentId, toSessionId } from '../../../core/transcript/ids'
import { parseWorkflowRunId } from '../../../core/transcript/workflowRunId'
import { NO_WORKFLOW_RUN_NAMES, readSessionWorkflowRunNames } from '../readSessionWorkflowRunNames'
import { createScanScheduler } from '../scanScheduler'
import type { WorkflowRunNamesCache } from '../workflowRunNamesCache'

function subagent(agentId: string, runId: string | null): SubagentEntry {
  return {
    agentId: toAgentId(agentId),
    transcript: { path: `/x/s/subagents/agent-${agentId}.jsonl`, mtimeMs: 1, size: 1 },
    metaPath: null,
    workflowRunId: runId === null ? null : parseWorkflowRunId(runId)
  }
}

function sessionWith(overrides: Partial<SessionEntry>): SessionEntry {
  return {
    sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
    sessionDir: '/x/s',
    transcript: ok({ path: '/x/s.jsonl', mtimeMs: 1, size: 1 }),
    subagents: ok([]),
    ...overrides
  }
}

/** Deps whose cache answers `['scan']`, and the keys the scheduler was asked to run. */
function setup(): {
  read: ReturnType<typeof vi.fn<WorkflowRunNamesCache['read']>>
  keys: string[]
  deps: Parameters<typeof readSessionWorkflowRunNames>[1]
} {
  const read = vi.fn<WorkflowRunNamesCache['read']>(() => Promise.resolve(['scan']))
  const scheduler = createScanScheduler({ maxConcurrent: 1 })
  const keys: string[] = []
  const summaries = {
    ...scheduler,
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      keys.push(key)
      return scheduler.run(key, task)
    }
  }
  return { read, keys, deps: { workflowRunNames: { read }, summaries } }
}

describe('readSessionWorkflowRunNames', () => {
  it('reads no names, with no scheduler turn, for a session whose transcript could not be read', async () => {
    const { read, keys, deps } = setup()
    const entry = sessionWith({
      transcript: err({ reason: 'unreadable', code: 'EACCES' }),
      subagents: ok([subagent('a', 'wf_a')])
    })

    expect(await readSessionWorkflowRunNames(entry, deps)).toBe(NO_WORKFLOW_RUN_NAMES)
    expect(keys).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })

  it('reads no names, with no scheduler turn, for a session whose subagents could not be listed', async () => {
    const { read, keys, deps } = setup()
    const entry = sessionWith({ subagents: err({ reason: 'unreadable', code: 'EACCES' }) })

    expect(await readSessionWorkflowRunNames(entry, deps)).toBe(NO_WORKFLOW_RUN_NAMES)
    expect(keys).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })

  it('reads no names, with no scheduler turn, for a session with no workflow runs', async () => {
    const { read, keys, deps } = setup()
    const entry = sessionWith({ subagents: ok([subagent('a', null)]) })

    expect(await readSessionWorkflowRunNames(entry, deps)).toBe(NO_WORKFLOW_RUN_NAMES)
    expect(keys).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })

  it('reads the distinct run ids through the scheduler in one call', async () => {
    const { read, keys, deps } = setup()
    const entry = sessionWith({
      subagents: ok([subagent('a', 'wf_b'), subagent('b', 'wf_a'), subagent('c', 'wf_b')])
    })

    const names = await readSessionWorkflowRunNames(entry, deps)

    expect(names).toEqual(['scan'])
    expect(keys).toHaveLength(1)
    expect(read).toHaveBeenCalledWith({ sessionDir: '/x/s', runIds: ['wf_a', 'wf_b'] })
  })
})
