import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkippedLineError } from '../../transcript/readRecords'
import { ok, type Result } from '../../transcript/result'
import { buildAssistantRecord, buildJsonlText, toJsonlLine } from '../../transcript/testFixtures'
import { scanSessionUsage } from '../scanSessionUsage'
import { createSessionUsageDir, type SessionUsageDir } from '../testSessionDir'

// Lets one test make a specific subagent transcript's read fail after
// yielding a valid record, to prove a mid-read failure doesn't leave that
// message claimed in the shared ledger. Every other path reads for real.
const { flakyPath } = vi.hoisted(() => ({ flakyPath: { current: null as string | null } }))

vi.mock('../../transcript/readRecords', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../transcript/readRecords')>()
  return {
    ...actual,
    readRecords: (filePath: string, readOptions?: Parameters<typeof actual.readRecords>[1]) =>
      filePath === flakyPath.current
        ? failAfterOneRecord()
        : actual.readRecords(filePath, readOptions)
  }
})

async function* failAfterOneRecord(): AsyncGenerator<
  Result<Record<string, unknown>, SkippedLineError>
> {
  yield ok(buildAssistantRecord({ messageId: 'msg_shared' }))
  const error = new Error('simulated mid-read failure') as NodeJS.ErrnoException
  error.code = 'EIO'
  throw error
}

let dir: SessionUsageDir

beforeEach(() => {
  dir = createSessionUsageDir()
})

afterEach(() => {
  dir.cleanup()
  flakyPath.current = null
})

describe('scanSessionUsage', () => {
  it('takes the per-field max of split records owned by the same agent', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_1',
          inputTokens: 50,
          outputTokens: 5,
          usageExtra: { cache_read_input_tokens: 100 }
        }),
        buildAssistantRecord({
          messageId: 'msg_1',
          inputTokens: 10,
          outputTokens: 90,
          usageExtra: { cache_read_input_tokens: 20 }
        })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.messageCount).toBe(1)
    expect(usage.lead.tokenGroups[0]?.tokens).toEqual({
      input: 50,
      output: 90,
      cacheRead: 100,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it("credits a fork's repeated lead message id to the lead, not the subagent", async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_fork', outputTokens: 10 })])
    )
    const subagent = dir.addSubagent(
      'atask1',
      buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_fork', outputTokens: 999 }),
        buildAssistantRecord({ messageId: 'msg_sub_only', outputTokens: 7 })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [subagent] })

    expect(usage.lead.messageCount).toBe(1)
    expect(usage.lead.tokenGroups[0]?.tokens.output).toBe(10)

    const subagentUsage = usage.subagents.get(subagent.agentId)
    expect(subagentUsage?.ok).toBe(true)
    if (subagentUsage?.ok) {
      expect(subagentUsage.value.messageCount).toBe(1)
      expect(subagentUsage.value.tokenGroups[0]?.tokens.output).toBe(7)
    }
  })

  it('counts a zero-usage synthetic message as a free message, not a skipped line', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_synth',
          model: '<synthetic>',
          inputTokens: 0,
          outputTokens: 0,
          usageExtra: { iterations: null }
        })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.skippedLines).toBe(0)
    expect(usage.lead.messageCount).toBe(1)
    expect(usage.lead.tokenGroups[0]?.price).toEqual({ kind: 'free' })
  })

  it('counts a malformed line as skipped without failing the scan', async () => {
    const content = `not valid json\n${toJsonlLine(buildAssistantRecord({ messageId: 'msg_1' }))}\n`
    const leadPath = dir.writeLead(content)

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.skippedLines).toBe(1)
    expect(usage.lead.messageCount).toBe(1)
  })

  it('counts an assistant record that fails schema validation as skipped', async () => {
    const invalidRecord = {
      type: 'assistant',
      message: { model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 } }
    }
    const leadPath = dir.writeLead(
      buildJsonlText([invalidRecord, buildAssistantRecord({ messageId: 'msg_ok' })])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.skippedLines).toBe(1)
    expect(usage.lead.messageCount).toBe(1)
  })

  it('counts an oversized message.id or message.model as skipped', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({ messageId: 'x'.repeat(257) }),
        buildAssistantRecord({ model: 'x'.repeat(257) }),
        buildAssistantRecord({ messageId: 'msg_ok' })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.skippedLines).toBe(2)
    expect(usage.lead.messageCount).toBe(1)
  })

  it('reports an empty transcript as zero messages with no groups', async () => {
    const leadPath = dir.writeLead('')

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead).toEqual({ tokenGroups: [], messageCount: 0, skippedLines: 0 })
  })

  it('isolates an unreadable subagent transcript while others still report', async () => {
    const leadPath = dir.writeLead('')
    const badSubagent = dir.missingSubagent('bad')
    const goodSubagent = dir.addSubagent(
      'good',
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_good' })])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [badSubagent, goodSubagent] })

    const badResult = usage.subagents.get(badSubagent.agentId)
    expect(badResult).toEqual({ ok: false, error: { reason: 'unreadable', code: 'ENOENT' } })

    const goodResult = usage.subagents.get(goodSubagent.agentId)
    expect(goodResult?.ok).toBe(true)
    if (goodResult?.ok) expect(goodResult.value.messageCount).toBe(1)
  })

  it('rejects when the lead transcript cannot be read', async () => {
    const leadPath = join(dir.writeLead(''), '..', 'missing-lead.jsonl')

    await expect(scanSessionUsage({ leadPath, subagents: [] })).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('keeps an explicit "fast" speed, unpriced, when a later record has none', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_1', usageExtra: { speed: 'fast' } }),
        buildAssistantRecord({ messageId: 'msg_1' })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.tokenGroups[0]?.speed).toBe('fast')
    expect(usage.lead.tokenGroups[0]?.price).toEqual({ kind: 'unpriced', reason: 'unknown-speed' })
  })

  it('prices a message that goes from an absent speed to an explicit "fast" as unknown-speed', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_1' }),
        buildAssistantRecord({ messageId: 'msg_1', usageExtra: { speed: 'fast' } })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.tokenGroups[0]?.speed).toBe('fast')
    expect(usage.lead.tokenGroups[0]?.price).toEqual({ kind: 'unpriced', reason: 'unknown-speed' })
  })

  it('prices an oversized or non-string speed as unknown-speed via the schema-narrowed sentinel', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_oversized', usageExtra: { speed: 'x'.repeat(33) } }),
        buildAssistantRecord({
          messageId: 'msg_object',
          usageExtra: { speed: { nested: 'json' } }
        })
      ])
    )

    const usage = await scanSessionUsage({ leadPath, subagents: [] })

    expect(usage.lead.tokenGroups).toHaveLength(1)
    expect(usage.lead.tokenGroups[0]?.speed).toBe('unknown')
    expect(usage.lead.tokenGroups[0]?.tokens.input).toBe(10)
    expect(usage.lead.tokenGroups[0]?.price).toEqual({ kind: 'unpriced', reason: 'unknown-speed' })
  })

  it("doesn't leave a message claimed in the ledger when its reporting subagent's read fails partway through", async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_lead' })])
    )
    const flakySubagent = dir.addSubagent(
      'flaky',
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_shared' })])
    )
    const laterSubagent = dir.addSubagent(
      'later',
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_shared' })])
    )
    flakyPath.current = flakySubagent.transcript.path

    const usage = await scanSessionUsage({
      leadPath,
      subagents: [flakySubagent, laterSubagent]
    })

    expect(usage.subagents.get(flakySubagent.agentId)?.ok).toBe(false)

    const laterResult = usage.subagents.get(laterSubagent.agentId)
    expect(laterResult?.ok).toBe(true)
    if (laterResult?.ok) expect(laterResult.value.messageCount).toBe(1)
  })
})
