import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../core/shared/result'
import { toProjectDirName, toSessionId } from '../../../core/transcript/ids'
import type { SessionSummary } from '../../../core/transcript/summary/sessionSummary'
import { buildSessionSummary } from '../../../core/transcript/summary/testSessionSummary'
import { mapSessionListItem, type ScannedSession } from '../mapSessionListItem'

const SUMMARY: SessionSummary = buildSessionSummary({
  title: 'A title',
  usage: { totalUSD: 1.5, totalTokens: 295 },
  activity: { earliestMs: 1, latestMs: 2 },
  skippedLines: 3,
  model: 'claude-opus-5'
})

function scanned(summary: ScannedSession['summary']): ScannedSession {
  return {
    projectDirName: toProjectDirName('-Users-a-repo'),
    entry: {
      sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
      transcript: ok({ path: '/x/s.jsonl', mtimeMs: 10, size: 20 }),
      subagents: ok([])
    },
    summary
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

  it('copies a null model', () => {
    const item = mapSessionListItem(scanned(ok({ ...SUMMARY, model: null })), null)

    expect(item.summary.ok && item.summary.value.model).toBeNull()
  })

  it('does not copy summary fields the DTO does not name', () => {
    const withExtra = { ...SUMMARY, futureField: 'x' } as SessionSummary
    const { summary } = mapSessionListItem(scanned(ok(withExtra)), null)

    expect(summary.ok).toBe(true)
    if (!summary.ok) return
    expect(Object.keys(summary.value)).not.toContain('futureField')
  })

  it('reports an unreadable summary as an error code', () => {
    const item = mapSessionListItem(scanned(err({ reason: 'unreadable', code: 'EACCES' })), null)

    expect(item.summary).toEqual({ ok: false, error: { code: 'unreadable' } })
  })
})
