import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import { toProjectDirName, toSessionId } from '../../../core/transcript/ids'
import type { SessionSummary } from '../../../core/transcript/summary/sessionSummary'
import { NO_AGENT_TERMS } from '../../../core/session/agentSearchTerms'
import { buildSessionSummary } from '../../../core/transcript/summary/testSessionSummary'
import { mapSessionListItem, type ScannedSession } from '../mapSessionListItem'

const SUMMARY: SessionSummary = buildSessionSummary({
  title: 'A title',
  usage: { totalUSD: 1.5, totalTokens: 295 },
  activity: { earliestMs: 1, latestMs: 2 },
  skippedLines: 3,
  model: 'claude-opus-5',
  transcriptTokens: 1200
})

function scanned(summary: ScannedSession['summary']): ScannedSession {
  return {
    projectDirName: toProjectDirName('-Users-a-repo'),
    entry: {
      sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
      transcript: ok({ path: '/x/s.jsonl', mtimeMs: 10, size: 20 }),
      subagents: ok([])
    },
    summary,
    agentTerms: NO_AGENT_TERMS
  }
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

  it('copies the agent terms and the truncation flag, and only the three term fields', () => {
    const withTerms: ScannedSession = {
      ...scanned(ok(SUMMARY)),
      agentTerms: {
        terms: [{ name: 'scout', description: null, agentType: 'Explore', extra: 1 } as never],
        truncated: true
      }
    }

    const item = mapSessionListItem(withTerms, null)

    expect(item.agentTerms).toEqual([{ name: 'scout', description: null, agentType: 'Explore' }])
    expect(item.agentTermsTruncated).toBe(true)
  })

  it('sends no agent terms for a session whose transcript could not be read', () => {
    const failed: ScannedSession = {
      ...scanned(ok(SUMMARY)),
      entry: {
        sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
        transcript: err({ reason: 'unreadable', code: 'ENOENT' }),
        subagents: ok([])
      },
      agentTerms: { terms: [{ name: 'x', description: null, agentType: null }], truncated: true }
    }

    const item = mapSessionListItem(failed, null)

    expect(item.agentTerms).toEqual([])
    expect(item.agentTermsTruncated).toBe(false)
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
      const failed: ScannedSession = {
        ...scanned(ok(SUMMARY)),
        entry: {
          sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
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
})
