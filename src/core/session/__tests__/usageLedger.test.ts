import { describe, expect, it } from 'vitest'
import { emptyTokenCounts } from '../../pricing/tokenCounts'
import { toAgentId } from '../../transcript/ids'
import { leadIdentity, subagentIdentity } from '../agentIdentity'
import { createUsageLedger, type MessageReport } from '../usageLedger'

function report(overrides: Partial<MessageReport> = {}): MessageReport {
  return {
    identity: leadIdentity,
    messageId: 'msg_1',
    model: 'claude-sonnet-5',
    speed: undefined,
    tokens: emptyTokenCounts,
    timestampMs: null,
    ...overrides
  }
}

describe('createUsageLedger', () => {
  it('owns a message id by the first agent to report it', () => {
    const ledger = createUsageLedger()
    const subagent = subagentIdentity(toAgentId('atask1'))

    ledger.report(report({ identity: subagent }))

    expect(ledger.entries()).toEqual([expect.objectContaining({ owner: subagent })])
  })

  it('takes the per-field max across split records from the same owner', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ tokens: { ...emptyTokenCounts, input: 10, output: 5 } }))
    ledger.report(report({ tokens: { ...emptyTokenCounts, input: 5, output: 20 } }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ tokens: { ...emptyTokenCounts, input: 10, output: 20 } })
    ])
  })

  it('ignores a later report of an owned id from a different agent', () => {
    const ledger = createUsageLedger()
    const subagent = subagentIdentity(toAgentId('atask1'))

    ledger.report(report({ identity: leadIdentity, tokens: { ...emptyTokenCounts, input: 10 } }))
    ledger.report(report({ identity: subagent, tokens: { ...emptyTokenCounts, input: 999 } }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ owner: leadIdentity, tokens: { ...emptyTokenCounts, input: 10 } })
    ])
  })

  it('keeps the model from the first record even if a later one differs', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ model: 'claude-sonnet-5' }))
    ledger.report(report({ model: 'claude-opus-5' }))

    expect(ledger.entries()).toEqual([expect.objectContaining({ model: 'claude-sonnet-5' })])
  })

  it('tracks the last explicitly present speed across split records', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ speed: undefined }))
    ledger.report(report({ speed: 'standard' }))

    expect(ledger.entries()).toEqual([expect.objectContaining({ speed: 'standard' })])
  })

  it('keeps the last explicit speed when a later record has none', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ speed: 'fast' }))
    ledger.report(report({ speed: undefined }))

    expect(ledger.entries()).toEqual([expect.objectContaining({ speed: 'fast' })])
  })

  it('takes the later of two explicit speeds', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ speed: 'standard' }))
    ledger.report(report({ speed: 'fast' }))

    expect(ledger.entries()).toEqual([expect.objectContaining({ speed: 'fast' })])
  })

  it('keeps the earliest and latest timestamp across records that run out of order', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ timestampMs: 2000 }))
    ledger.report(report({ timestampMs: 3000 }))
    ledger.report(report({ timestampMs: 1000 }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ earliestMs: 1000, latestMs: 3000 })
    ])
  })

  it('keeps the timestamp span when a later record has no timestamp', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ timestampMs: 1000 }))
    ledger.report(report({ timestampMs: null }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ earliestMs: 1000, latestMs: 1000 })
    ])
  })

  it('takes a timestamp from a later record when the first had none', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ timestampMs: null }))
    ledger.report(report({ timestampMs: 1000 }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ earliestMs: 1000, latestMs: 1000 })
    ])
  })

  it('has no span when no record carried a timestamp', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ timestampMs: null }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ earliestMs: null, latestMs: null })
    ])
  })

  it('ignores the timestamp of a later report from a different agent', () => {
    const ledger = createUsageLedger()
    const subagent = subagentIdentity(toAgentId('atask1'))

    ledger.report(report({ identity: leadIdentity, timestampMs: 1000 }))
    ledger.report(report({ identity: subagent, timestampMs: 9000 }))

    expect(ledger.entries()).toEqual([
      expect.objectContaining({ earliestMs: 1000, latestMs: 1000 })
    ])
  })

  it('lists entries in first-reported order', () => {
    const ledger = createUsageLedger()

    ledger.report(report({ messageId: 'msg_b' }))
    ledger.report(report({ messageId: 'msg_a' }))

    expect(ledger.entries().map((entry) => entry.messageId)).toEqual(['msg_b', 'msg_a'])
  })
})
