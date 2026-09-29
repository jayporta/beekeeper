import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import {
  agentIdentityKey,
  leadIdentity,
  subagentIdentity,
  type AgentIdentity
} from '../agentIdentity'
import type { FileTouch } from '../fileTouchCollector'
import {
  createFilesLedger,
  MAX_BASH_TOUCHES_PER_SESSION,
  MAX_INCOMPLETE_RESULTS_PER_SESSION
} from '../filesLedger'

function touch(overrides: Partial<FileTouch> = {}): FileTouch {
  return {
    filePath: '/repo/src/example.ts',
    operation: 'edit',
    source: 'edit-write',
    toolUseId: 'toolu_1',
    ...overrides
  }
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

  it('ignores a repeat of a path the owner already reported for a toolUseId', () => {
    const ledger = createFilesLedger()

    ledger.report({ identity: leadIdentity, touch: touch() })
    ledger.report({ identity: leadIdentity, touch: touch({ operation: 'update' }) })

    expect(ledger.entries()).toEqual([{ owner: leadIdentity, touch: touch() }])
  })

  it('keeps every path one agent reports for a toolUseId, as a Bash command changes several', () => {
    const ledger = createFilesLedger()

    ledger.report({ identity: leadIdentity, touch: touch({ filePath: '/repo/src/first.ts' }) })
    ledger.report({ identity: leadIdentity, touch: touch({ filePath: '/repo/src/second.ts' }) })

    expect(ledger.entries().map((entry) => entry.touch.filePath)).toEqual([
      '/repo/src/first.ts',
      '/repo/src/second.ts'
    ])
  })

  it('credits an incomplete result to the first agent to report its toolUseId', () => {
    const ledger = createFilesLedger()
    const subagent = subagentIdentity(toAgentId('atask1'))

    ledger.reportIncomplete({ identity: leadIdentity, toolUseId: 'toolu_1' })
    ledger.reportIncomplete({ identity: subagent, toolUseId: 'toolu_1' })

    expect(ledger.incompleteOwners()).toEqual([leadIdentity])
  })

  it('lists an agent once however many of its results are incomplete', () => {
    const ledger = createFilesLedger()

    ledger.reportIncomplete({ identity: leadIdentity, toolUseId: 'toolu_1' })
    ledger.reportIncomplete({ identity: leadIdentity, toolUseId: 'toolu_2' })

    expect(ledger.incompleteOwners()).toEqual([leadIdentity])
  })

  it("marks the lead and a fork that repeats the lead's result once the ledger no longer remembers ids", () => {
    const ledger = createFilesLedger()
    const filler = subagentIdentity(toAgentId('filler'))
    const fork = subagentIdentity(toAgentId('atask1'))
    for (let index = 0; index < MAX_INCOMPLETE_RESULTS_PER_SESSION; index += 1) {
      ledger.reportIncomplete({ identity: filler, toolUseId: `toolu_${index}` })
    }

    // Reported after the ledger was full, so its id is not remembered.
    ledger.reportIncomplete({ identity: leadIdentity, toolUseId: 'toolu_late' })
    ledger.reportIncomplete({ identity: fork, toolUseId: 'toolu_late' })

    expect(ledger.incompleteOwners()).toEqual([filler, leadIdentity, fork])
  })

  it('marks an agent incomplete outright when asked', () => {
    const ledger = createFilesLedger()

    ledger.markIncomplete(leadIdentity)
    ledger.markIncomplete(leadIdentity)

    expect(ledger.incompleteOwners()).toEqual([leadIdentity])
  })

  describe('session-wide Bash cap', () => {
    const bashTouch = (toolUseId: string, filePath: string): FileTouch =>
      touch({ toolUseId, filePath, operation: 'update', source: 'bash' })

    /** Has `identity` report `count` distinct Bash paths under one tool use id. */
    function reportBash(options: {
      readonly ledger: ReturnType<typeof createFilesLedger>
      readonly identity: AgentIdentity
      readonly count: number
    }): void {
      const { ledger, identity, count } = options
      const id = `toolu_${agentIdentityKey(identity)}`
      for (let index = 0; index < count; index += 1) {
        ledger.report({ identity, touch: bashTouch(id, `/repo/${id}/${index}.ts`) })
      }
    }

    it('keeps Bash touches up to the cap across agents, and marks only the agent whose touches were cut', () => {
      const ledger = createFilesLedger()
      const second = subagentIdentity(toAgentId('second'))
      const third = subagentIdentity(toAgentId('third'))

      reportBash({ ledger, identity: leadIdentity, count: MAX_BASH_TOUCHES_PER_SESSION - 10 })
      reportBash({ ledger, identity: second, count: 10 })
      reportBash({ ledger, identity: third, count: 5 })

      expect(ledger.entries()).toHaveLength(MAX_BASH_TOUCHES_PER_SESSION)
      expect(ledger.incompleteOwners()).toEqual([third])
    })

    it('checks the owner and duplicates before the cap, so a fork or a repeat marks nobody', () => {
      const ledger = createFilesLedger()
      const fork = subagentIdentity(toAgentId('fork'))
      reportBash({ ledger, identity: leadIdentity, count: MAX_BASH_TOUCHES_PER_SESSION })
      const leadId = `toolu_${agentIdentityKey(leadIdentity)}`

      // A fork repeating one of the lead's kept touches, and the lead repeating a path.
      ledger.report({ identity: fork, touch: bashTouch(leadId, `/repo/${leadId}/0.ts`) })
      ledger.report({ identity: leadIdentity, touch: bashTouch(leadId, `/repo/${leadId}/1.ts`) })

      expect(ledger.entries()).toHaveLength(MAX_BASH_TOUCHES_PER_SESSION)
      expect(ledger.incompleteOwners()).toEqual([])
    })

    it('records no owner for a new Bash tool use id past the cap, so a fork copy of it is cut and marked too', () => {
      const ledger = createFilesLedger()
      const first = subagentIdentity(toAgentId('first'))
      const copy = subagentIdentity(toAgentId('copy'))
      reportBash({ ledger, identity: leadIdentity, count: MAX_BASH_TOUCHES_PER_SESSION })

      // Had `first` been recorded as the owner of this id, `copy` would be deduped and go unmarked.
      ledger.report({ identity: first, touch: bashTouch('toolu_new', '/repo/new.ts') })
      ledger.report({ identity: copy, touch: bashTouch('toolu_new', '/repo/new.ts') })

      expect(ledger.incompleteOwners()).toEqual([first, copy])
    })

    it('does not count Edit and Write touches against the cap', () => {
      const ledger = createFilesLedger()
      const editor = subagentIdentity(toAgentId('editor'))

      reportBash({ ledger, identity: leadIdentity, count: MAX_BASH_TOUCHES_PER_SESSION })
      ledger.report({ identity: editor, touch: touch({ toolUseId: 'toolu_edit' }) })

      expect(ledger.entries()).toHaveLength(MAX_BASH_TOUCHES_PER_SESSION + 1)
      expect(ledger.incompleteOwners()).toEqual([])
    })
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
