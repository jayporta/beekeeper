import { describe, expect, it, vi } from 'vitest'
import { NO_AGENT_TERMS } from '../../../core/session/agentSearchTerms'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import { toAgentId, toSessionId } from '../../../core/transcript/ids'
import type { AgentTermsCache } from '../agentTermsCache'
import { readSessionAgentTerms } from '../readSessionAgentTerms'
import { createScanScheduler } from '../scanScheduler'

const SUBAGENT = {
  agentId: toAgentId('a1'),
  transcript: { path: '/x/s/subagents/agent-a1.jsonl', mtimeMs: 1, size: 1 },
  metaPath: '/x/s/subagents/agent-a1.meta.json',
  workflowRunId: null
}

describe('readSessionAgentTerms', () => {
  it('reads no terms for a session whose transcript could not be read', async () => {
    const read = vi.fn<AgentTermsCache['read']>(() => Promise.resolve(NO_AGENT_TERMS))
    const entry: SessionEntry = {
      sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
      transcript: err({ reason: 'unreadable', code: 'EACCES' }),
      subagents: ok([SUBAGENT])
    }

    const terms = await readSessionAgentTerms(entry, {
      agentTerms: { read },
      summaries: createScanScheduler({ maxConcurrent: 1 })
    })

    expect(read).not.toHaveBeenCalled()
    expect(terms).toBe(NO_AGENT_TERMS)
  })
})
