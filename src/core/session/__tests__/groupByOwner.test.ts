import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { agentIdentityKey, leadIdentity, subagentIdentity } from '../agentIdentity'
import { groupByOwner } from '../groupByOwner'

interface Entry {
  readonly owner: ReturnType<typeof subagentIdentity> | typeof leadIdentity
  readonly value: string
}

describe('groupByOwner', () => {
  it('returns an empty map for no entries', () => {
    expect(groupByOwner<Entry>([]).size).toBe(0)
  })

  it('groups entries under their owner identity key, preserving order', () => {
    const subagent = subagentIdentity(toAgentId('atask1'))
    const entries: Entry[] = [
      { owner: leadIdentity, value: 'a' },
      { owner: subagent, value: 'b' },
      { owner: leadIdentity, value: 'c' }
    ]

    const grouped = groupByOwner(entries)

    expect(grouped.get(agentIdentityKey(leadIdentity))).toEqual([
      { owner: leadIdentity, value: 'a' },
      { owner: leadIdentity, value: 'c' }
    ])
    expect(grouped.get(agentIdentityKey(subagent))).toEqual([{ owner: subagent, value: 'b' }])
  })
})
