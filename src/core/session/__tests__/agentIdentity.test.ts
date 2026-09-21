import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import {
  agentIdentityEquals,
  agentIdentityKey,
  leadIdentity,
  subagentIdentity
} from '../agentIdentity'

describe('agentIdentityEquals', () => {
  it('treats two lead identities as equal', () => {
    expect(agentIdentityEquals(leadIdentity, { kind: 'lead' })).toBe(true)
  })

  it('treats two subagent identities with the same id as equal', () => {
    const agentId = toAgentId('atask1')

    expect(agentIdentityEquals(subagentIdentity(agentId), subagentIdentity(agentId))).toBe(true)
  })

  it('treats subagents with different ids as different', () => {
    const a = subagentIdentity(toAgentId('atask1'))
    const b = subagentIdentity(toAgentId('atask2'))

    expect(agentIdentityEquals(a, b)).toBe(false)
  })

  it('treats the lead and a subagent as different, even one whose id is "lead"', () => {
    const impostor = subagentIdentity(toAgentId('lead'))

    expect(agentIdentityEquals(leadIdentity, impostor)).toBe(false)
  })
})

describe('agentIdentityKey', () => {
  it('gives the lead a stable key', () => {
    expect(agentIdentityKey(leadIdentity)).toBe(agentIdentityKey({ kind: 'lead' }))
  })

  it('gives subagents with different ids different keys', () => {
    const a = agentIdentityKey(subagentIdentity(toAgentId('atask1')))
    const b = agentIdentityKey(subagentIdentity(toAgentId('atask2')))

    expect(a).not.toBe(b)
  })

  it('never collides the lead key with a subagent whose id is "lead"', () => {
    const leadKey = agentIdentityKey(leadIdentity)
    const impostorKey = agentIdentityKey(subagentIdentity(toAgentId('lead')))

    expect(leadKey).not.toBe(impostorKey)
  })
})
