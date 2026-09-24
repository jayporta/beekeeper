import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAssistantRecord,
  buildCostStateRecord,
  buildJsonlText
} from '../../transcript/testFixtures'
import { scanSession } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

describe('scanSession reconciliation', () => {
  it('sets the transcripts beside the lead cost-state, per normalized model', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_lead',
          model: 'claude-opus-5',
          inputTokens: 100,
          outputTokens: 40
        }),
        buildAssistantRecord({
          messageId: 'msg_syn',
          model: '<synthetic>',
          inputTokens: 0,
          outputTokens: 0
        }),
        buildCostStateRecord({
          modelUsage: { 'claude-opus-5[1m]': { inputTokens: 1, costUSD: 1 } },
          totalCostUSD: 1
        }),
        buildCostStateRecord({
          modelUsage: {
            'claude-opus-5[1m]': { inputTokens: 150, outputTokens: 60, costUSD: 2 },
            'claude-haiku-4-5': { inputTokens: 7, costUSD: 0.5 }
          },
          totalCostUSD: 2.5
        })
      ])
    )
    const subagent = dir.addSubagent('asub1', {
      transcript: buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_sub',
          model: 'claude-sonnet-5',
          inputTokens: 20,
          outputTokens: 5
        })
      ])
    })

    const { reconciliation } = await scanSession({ leadPath, subagents: [subagent] })

    const rows = new Map(reconciliation.models.map((row) => [row.model, row]))
    expect([...rows.keys()]).toEqual([
      '<synthetic>',
      'claude-haiku-4-5',
      'claude-opus-5',
      'claude-sonnet-5'
    ])
    expect(rows.get('claude-opus-5')?.transcript).toMatchObject({ input: 100, output: 40 })
    expect(rows.get('claude-opus-5')?.recorded).toEqual({
      input: 150,
      output: 60,
      cacheRead: 0,
      cacheWrite: 0,
      costUSD: 2,
      partial: false
    })
    expect(rows.get('claude-sonnet-5')?.transcript).toMatchObject({ input: 20, output: 5 })
    expect(rows.get('claude-sonnet-5')?.recorded).toBeNull()
    expect(rows.get('claude-haiku-4-5')?.transcript).toBeNull()
    expect(rows.get('<synthetic>')?.recorded).toBeNull()
    expect(reconciliation.totals.recordedUSD).toBe(2.5)
    expect(reconciliation.totals.transcriptPartial).toBe(false)
  })

  it('reports no recorded total for a session with no cost-state', async () => {
    const leadPath = dir.writeLead(buildJsonlText([buildAssistantRecord()]))

    const { reconciliation } = await scanSession({ leadPath, subagents: [] })

    expect(reconciliation.totals.recordedUSD).toBeNull()
  })

  it('flags the totals partial when a subagent transcript is unreadable', async () => {
    const leadPath = dir.writeLead(buildJsonlText([buildAssistantRecord()]))

    const { reconciliation } = await scanSession({
      leadPath,
      subagents: [dir.missingSubagent('agone')]
    })

    expect(reconciliation.totals.transcriptPartial).toBe(true)
  })

  it('flags the totals partial when the subagents folder was unreadable', async () => {
    const leadPath = dir.writeLead(buildJsonlText([buildAssistantRecord()]))

    const { reconciliation } = await scanSession({
      leadPath,
      subagents: [],
      subagentsUnreadable: true
    })

    expect(reconciliation.totals.transcriptPartial).toBe(true)
  })
})
