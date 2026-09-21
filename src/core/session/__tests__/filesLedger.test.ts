import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { leadIdentity, subagentIdentity } from '../agentIdentity'
import type { FileTouch } from '../fileTouchCollector'
import { createFilesLedger } from '../filesLedger'

function touch(overrides: Partial<FileTouch> = {}): FileTouch {
  return { filePath: '/repo/src/example.ts', operation: 'edit', toolUseId: 'toolu_1', ...overrides }
}

describe('createFilesLedger', () => {
  it('owns a touch by the first agent to report its toolUseId', () => {
    const ledger = createFilesLedger()
    const subagent = subagentIdentity(toAgentId('atask1'))

    ledger.report({ identity: subagent, touch: touch() })

    expect(ledger.entries()).toEqual([{ owner: subagent, touch: touch() }])
  })

  it("keeps the lead's touch when a fork repeats the same toolUseId", () => {
    const ledger = createFilesLedger()
    const subagent = subagentIdentity(toAgentId('atask1'))

    ledger.report({ identity: leadIdentity, touch: touch({ filePath: '/repo/src/lead.ts' }) })
    ledger.report({ identity: subagent, touch: touch({ filePath: '/repo/src/forked.ts' }) })

    expect(ledger.entries()).toEqual([
      { owner: leadIdentity, touch: touch({ filePath: '/repo/src/lead.ts' }) }
    ])
  })

  it('ignores a later report of an already-owned toolUseId from the same agent', () => {
    const ledger = createFilesLedger()

    ledger.report({ identity: leadIdentity, touch: touch({ filePath: '/repo/src/first.ts' }) })
    ledger.report({ identity: leadIdentity, touch: touch({ filePath: '/repo/src/second.ts' }) })

    expect(ledger.entries()).toEqual([
      { owner: leadIdentity, touch: touch({ filePath: '/repo/src/first.ts' }) }
    ])
  })

  it('tracks touches for different toolUseIds separately', () => {
    const ledger = createFilesLedger()

    ledger.report({ identity: leadIdentity, touch: touch({ toolUseId: 'toolu_a' }) })
    ledger.report({ identity: leadIdentity, touch: touch({ toolUseId: 'toolu_b' }) })

    expect(ledger.entries()).toHaveLength(2)
  })

  it('lists entries in first-reported order', () => {
    const ledger = createFilesLedger()

    ledger.report({ identity: leadIdentity, touch: touch({ toolUseId: 'toolu_b' }) })
    ledger.report({ identity: leadIdentity, touch: touch({ toolUseId: 'toolu_a' }) })

    expect(ledger.entries().map((entry) => entry.touch.toolUseId)).toEqual(['toolu_b', 'toolu_a'])
  })
})
