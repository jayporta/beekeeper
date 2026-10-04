import { describe, expect, it } from 'vitest'
import { testGraphNode } from '../testGraphNode'
import { testGraphT } from '../testGraphT'
import { nodeAccessibleName, nodeDetail } from '../nodeFacts'

const nameOf = (overrides: Parameters<typeof testGraphNode>[2], loading = false): string =>
  nodeAccessibleName(testGraphNode('lead', [], { name: 'Lead', kind: 'lead', ...overrides }), {
    t: testGraphT,
    loading
  })

describe('nodeDetail', () => {
  it('is the type and the model', () => {
    const node = testGraphNode('a', [], { agentType: 'Explore', model: 'claude-haiku-5' })

    expect(nodeDetail(node, testGraphT)).toEqual(['Explore', 'claude-haiku-5'])
  })

  it('leaves out a type or model that is unknown', () => {
    expect(nodeDetail(testGraphNode('a', [], { model: 'claude-haiku-5' }), testGraphT)).toEqual([
      'claude-haiku-5'
    ])
    expect(nodeDetail(testGraphNode('a'), testGraphT)).toEqual([])
  })

  it('is the folder, not the type and model, for a teammate in another folder', () => {
    const node = testGraphNode('a', [], { agentType: 'code', model: 'm', folder: '-Users-a-other' })

    expect(nodeDetail(node, testGraphT)).toEqual(['in -Users-a-other'])
  })
})

describe('nodeAccessibleName', () => {
  it('gives the name, kind, tokens, then type and model', () => {
    const label = nameOf({ tokens: 1500, agentType: 'Explore', model: 'claude-haiku-5' })

    expect(label).toBe('Lead, lead, 1.5K tokens, Explore, claude-haiku-5')
  })

  it('names the kind of a teammate and of a subagent', () => {
    expect(nameOf({ kind: 'teammate', tokens: 1 })).toBe('Lead, teammate, 1 token')
    expect(nameOf({ kind: 'subagent', tokens: 1 })).toBe('Lead, subagent, 1 token')
  })

  it('says tokens are not recorded when there are none to show', () => {
    expect(nameOf({ tokens: null })).toBe('Lead, lead, tokens not recorded')
  })

  it('counts zero tokens', () => {
    expect(nameOf({ tokens: 0 })).toBe('Lead, lead, 0 tokens')
  })

  it('names the flags last', () => {
    const label = nameOf({ tokens: 5, model: 'm', stopped: true, partial: true })

    expect(label).toBe('Lead, lead, 5 tokens, m, stopped, partial data')
  })

  it('says a teammate is still loading its subagents, after the stopped flag', () => {
    expect(nameOf({ kind: 'teammate', tokens: 5, stopped: true }, true)).toBe(
      'Lead, teammate, 5 tokens, stopped, loading subagents'
    )
  })

  it('names the folder of a teammate in another folder', () => {
    expect(nameOf({ kind: 'teammate', tokens: 5, folder: '-other' })).toBe(
      'Lead, teammate, 5 tokens, in -other'
    )
  })
})
