import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import { toProjectDirName, toSessionId } from '../../../core/transcript/ids'
import type { SessionSummary } from '../../../core/transcript/summary/sessionSummary'
import { NO_AGENT_TERMS } from '../../../core/session/agentSearchTerms'
import { NO_WORKFLOW_RUN_NAMES } from '../readSessionWorkflowRunNames'
import { buildSessionSummary } from '../../../core/transcript/summary/testSessionSummary'
import { toAgentId } from '../../../core/transcript/ids'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import { parseWorkflowRunId } from '../../../core/transcript/workflowRunId'
import { mapSessionListItem, type ListableSession } from '../mapSessionListItem'

const SUMMARY: SessionSummary = buildSessionSummary({
  title: 'A title',
  usage: { totalUSD: 1.5, totalTokens: 295 },
  activity: { earliestMs: 1, latestMs: 2 },
  skippedLines: 3,
  model: 'claude-opus-5',
  transcriptTokens: 1200
})

function scanned(summary: ListableSession['summary']): ListableSession {
  return {
    projectDirName: toProjectDirName('-Users-a-repo'),
    entry: {
      sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
      sessionDir: '/x/11111111-1111-4111-8111-111111111111',
      transcript: ok({ path: '/x/s.jsonl', mtimeMs: 10, size: 20 }),
      subagents: ok([])
    },
    summary,
    agentTerms: NO_AGENT_TERMS,
    workflowRunNames: NO_WORKFLOW_RUN_NAMES
  }
}

/** A subagent entry in the given run, or directly in `subagents/` for `null`. */
function subagent(agentId: string, runId: string | null): SubagentEntry {
  return {
    agentId: toAgentId(agentId),
    transcript: { path: `/x/agent-${agentId}.jsonl`, mtimeMs: 1, size: 1 },
    metaPath: null,
    workflowRunId: runId === null ? null : parseWorkflowRunId(runId)
  }
}

/** A readable session whose subagents are the given entries. */
function scannedWith(entries: readonly SubagentEntry[]): ListableSession {
  const base = scanned(ok(SUMMARY))
  return { ...base, entry: { ...base.entry, subagents: ok(entries) } }
}

describe('mapSessionListItem', () => {
  it('copies the summary model to the item', () => {
    const item = mapSessionListItem(scanned(ok(SUMMARY)), null)

    expect(item.summary.ok && item.summary.value.model).toBe('claude-opus-5')
  })

  it('copies the summary usage, tokens included, to the item', () => {
    const item = mapSessionListItem(scanned(ok(SUMMARY)), null)

    expect(item.summary.ok && item.summary.value.usage).toEqual({
      totalUSD: 1.5,
      totalTokens: 295
    })
  })

  it('copies the transcript token total to the item', () => {
    const item = mapSessionListItem(scanned(ok(SUMMARY)), null)

    expect(item.summary.ok && item.summary.value.transcriptTokens).toBe(1200)
  })

  it('copies a null transcript token total', () => {
    const item = mapSessionListItem(scanned(ok({ ...SUMMARY, transcriptTokens: null })), null)

    expect(item.summary.ok && item.summary.value.transcriptTokens).toBeNull()
  })

  it('copies a null model', () => {
    const item = mapSessionListItem(scanned(ok({ ...SUMMARY, model: null })), null)

    expect(item.summary.ok && item.summary.value.model).toBeNull()
  })

  it('copies the plan limit hit, and only its two fields', () => {
    const limitHit = {
      window: 'fiveHour',
      resetsAtMs: 1_767_243_600_000,
      extra: 'dropped'
    } as const
    const item = mapSessionListItem(scanned(ok({ ...SUMMARY, limitHit })), null)

    expect(item.summary.ok && item.summary.value.limitHit).toEqual({
      window: 'fiveHour',
      resetsAtMs: 1_767_243_600_000
    })
  })

  it('copies a null plan limit hit', () => {
    const item = mapSessionListItem(scanned(ok(SUMMARY)), null)

    expect(item.summary.ok && item.summary.value.limitHit).toBeNull()
  })

  it('sends exactly the summary fields the DTO names', () => {
    const { summary } = mapSessionListItem(scanned(ok(SUMMARY)), null)

    expect(summary.ok && Object.keys(summary.value).sort()).toEqual([
      'activity',
      'limitHit',
      'model',
      'role',
      'skippedLines',
      'title',
      'transcriptTokens',
      'usage'
    ])
  })

  it('does not copy summary fields the DTO does not name', () => {
    const withExtra = { ...SUMMARY, futureField: 'x' } as SessionSummary
    const { summary } = mapSessionListItem(scanned(ok(withExtra)), null)

    expect(summary.ok).toBe(true)
    if (!summary.ok) return
    expect(Object.keys(summary.value)).not.toContain('futureField')
  })

  it('copies the agent terms, and only the three term fields', () => {
    const withTerms: ListableSession = {
      ...scanned(ok(SUMMARY)),
      agentTerms: [{ name: 'scout', description: null, agentType: 'Explore', extra: 1 } as never]
    }

    const item = mapSessionListItem(withTerms, null)

    expect(item.agentTerms).toEqual([{ name: 'scout', description: null, agentType: 'Explore' }])
  })

  it('sends no agent terms for a session whose transcript could not be read', () => {
    const failed: ListableSession = {
      ...scanned(ok(SUMMARY)),
      entry: {
        sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
        sessionDir: '/x/11111111-1111-4111-8111-111111111111',
        transcript: err({ reason: 'unreadable', code: 'ENOENT' }),
        subagents: ok([])
      },
      agentTerms: [{ name: 'x', description: null, agentType: 'Explore' }]
    }

    const item = mapSessionListItem(failed, null)

    expect(item.agentTerms).toEqual([])
  })

  it('copies the workflow run names', () => {
    const withNames: ListableSession = {
      ...scanned(ok(SUMMARY)),
      workflowRunNames: ['scan', 'review']
    }

    expect(mapSessionListItem(withNames, null).workflowRunNames).toEqual(['scan', 'review'])
  })

  it('sends no workflow run names for a session whose transcript could not be read', () => {
    const base = scanned(ok(SUMMARY))
    const failed: ListableSession = {
      ...base,
      entry: { ...base.entry, transcript: err({ reason: 'unreadable', code: 'ENOENT' }) },
      workflowRunNames: ['scan']
    }

    expect(mapSessionListItem(failed, null).workflowRunNames).toEqual([])
  })

  it('reports an unreadable summary as an error code', () => {
    const item = mapSessionListItem(scanned(err({ reason: 'unreadable', code: 'EACCES' })), null)

    expect(item.summary).toEqual({ ok: false, error: { code: 'unreadable' } })
  })

  describe('with an unmapped read failure', () => {
    let spy: MockInstance<typeof console.error>

    beforeEach(() => {
      spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      spy.mockRestore()
    })

    it('reports an unmapped summary failure as internal and logs its code', () => {
      const item = mapSessionListItem(scanned(err({ reason: 'unreadable', code: 'EIO' })), null)

      expect(item.summary).toEqual({ ok: false, error: { code: 'internal' } })
      expect(spy).toHaveBeenCalledExactlyOnceWith(
        'Beekeeper hit an internal error handling an IPC call (EIO).'
      )
    })

    it('logs an unmapped transcript stat failure by code', () => {
      const failed: ListableSession = {
        ...scanned(ok(SUMMARY)),
        entry: {
          sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
          sessionDir: '/x/11111111-1111-4111-8111-111111111111',
          transcript: err({ reason: 'unreadable', code: 'EIO' }),
          subagents: ok([])
        }
      }

      const item = mapSessionListItem(failed, null)

      expect(item.summary).toEqual({ ok: false, error: { code: 'internal' } })
      expect(spy).toHaveBeenCalledExactlyOnceWith(
        'Beekeeper hit an internal error handling an IPC call (EIO).'
      )
    })
  })

  describe('workflows', () => {
    it('counts the distinct runs and the agents inside them, apart from top-level agents', () => {
      const item = mapSessionListItem(
        scannedWith([
          subagent('top', null),
          subagent('a', 'wf_1'),
          subagent('b', 'wf_1'),
          subagent('c', 'wf_2')
        ]),
        null
      )

      expect(item.workflows).toEqual({ runs: 2, agents: 3 })
      expect(item.subagentCount).toBe(4)
    })

    it('counts no runs for a session with only top-level agents', () => {
      const item = mapSessionListItem(scannedWith([subagent('top', null)]), null)

      expect(item.workflows).toEqual({ runs: 0, agents: 0 })
    })

    it('counts no runs for a session with no subagents', () => {
      expect(mapSessionListItem(scanned(ok(SUMMARY)), null).workflows).toEqual({
        runs: 0,
        agents: 0
      })
    })

    it('is null when the subagents folder could not be listed', () => {
      const base = scanned(ok(SUMMARY))
      const failed: ListableSession = {
        ...base,
        entry: { ...base.entry, subagents: err({ reason: 'unreadable', code: 'EACCES' }) }
      }

      expect(mapSessionListItem(failed, null).workflows).toBeNull()
    })

    it('still counts runs when the transcript could not be read', () => {
      const base = scannedWith([subagent('a', 'wf_1')])
      const failed: ListableSession = {
        ...base,
        entry: { ...base.entry, transcript: err({ reason: 'unreadable', code: 'ENOENT' }) }
      }

      expect(mapSessionListItem(failed, null).workflows).toEqual({ runs: 1, agents: 1 })
    })
  })
})
