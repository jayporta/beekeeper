import { describe, expect, it } from 'vitest'
import type { SignalEvent } from '../../transcript/signals/signalEvent'
import { toAgentId } from '../../transcript/ids'
import { agentIdentityKey, leadIdentity, subagentIdentity } from '../agentIdentity'
import { createSignalsLedger, MAX_SIGNAL_EVENTS_PER_SESSION } from '../signalsLedger'

const fork = subagentIdentity(toAgentId('afork1'))

const errored = (toolUseId: string): SignalEvent => ({
  kind: 'tool-result',
  toolUseId,
  isError: true,
  atMs: null
})

describe('createSignalsLedger', () => {
  it('owns an event by the first agent to report its key', () => {
    const ledger = createSignalsLedger()

    ledger.report({ identity: fork, event: errored('toolu_1') })

    expect(ledger.entries()).toEqual([{ owner: fork, event: errored('toolu_1') }])
  })

  it("ignores a second agent's copy of an event", () => {
    const ledger = createSignalsLedger()

    ledger.report({ identity: leadIdentity, event: errored('toolu_1') })
    ledger.report({ identity: fork, event: errored('toolu_1') })

    expect(ledger.entries()).toEqual([{ owner: leadIdentity, event: errored('toolu_1') }])
  })

  it("ignores the same agent's duplicate of an event", () => {
    const ledger = createSignalsLedger()

    ledger.report({ identity: leadIdentity, event: errored('toolu_1') })
    ledger.report({ identity: leadIdentity, event: errored('toolu_1') })

    expect(ledger.entries()).toHaveLength(1)
  })

  it('keeps a call and a result of the same tool use id apart', () => {
    const ledger = createSignalsLedger()
    const call: SignalEvent = {
      kind: 'tool-call',
      toolUseId: 'toolu_1',
      tool: 'Read',
      commandHash: null,
      atMs: null
    }

    ledger.report({ identity: leadIdentity, event: call })
    ledger.report({ identity: leadIdentity, event: errored('toolu_1') })

    expect(ledger.entries()).toHaveLength(2)
  })

  it('keeps first-reported order', () => {
    const ledger = createSignalsLedger()

    ledger.report({ identity: fork, event: errored('b') })
    ledger.report({ identity: leadIdentity, event: errored('a') })

    expect(ledger.entries().map((entry) => entry.event)).toEqual([errored('b'), errored('a')])
  })

  it('drops a new event past the session cap and marks the reporter capped', () => {
    const ledger = createSignalsLedger()
    for (let index = 0; index < MAX_SIGNAL_EVENTS_PER_SESSION; index += 1) {
      ledger.report({ identity: leadIdentity, event: errored(`t${index}`) })
    }

    ledger.report({ identity: fork, event: errored('one-too-many') })

    expect(ledger.entries()).toHaveLength(MAX_SIGNAL_EVENTS_PER_SESSION)
    expect([...ledger.cappedOwners()]).toEqual([agentIdentityKey(fork)])
  })

  it('does not mark an agent capped for repeating an event the ledger already holds', () => {
    const ledger = createSignalsLedger()
    for (let index = 0; index < MAX_SIGNAL_EVENTS_PER_SESSION; index += 1) {
      ledger.report({ identity: leadIdentity, event: errored(`t${index}`) })
    }

    ledger.report({ identity: fork, event: errored('t0') })

    expect(ledger.cappedOwners().size).toBe(0)
  })

  it('marks an agent capped on request', () => {
    const ledger = createSignalsLedger()

    ledger.markCapped(fork)

    expect([...ledger.cappedOwners()]).toEqual([agentIdentityKey(fork)])
  })
})
