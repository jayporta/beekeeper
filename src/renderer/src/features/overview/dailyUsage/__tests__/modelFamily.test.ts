import { describe, expect, it } from 'vitest'
import { FAMILIES, modelFamily } from '../modelFamily'

describe('modelFamily', () => {
  it.each([
    ['claude-opus-4-5', 'opus'],
    ['claude-3-5-sonnet-20241022', 'sonnet'],
    ['claude-haiku-4-5', 'haiku'],
    ['claude-fable-1', 'fable'],
    ['us.anthropic.claude-haiku-4-5-v1:0', 'haiku'],
    ['anthropic/claude-sonnet-4', 'sonnet'],
    ['opus', 'opus']
  ])('puts %s in the %s family', (id, family) => {
    expect(modelFamily(id)).toBe(family)
  })

  it('matches without regard to case', () => {
    expect(modelFamily('Claude-OPUS-4')).toBe('opus')
  })

  it.each(['<synthetic>', '', 'gpt-5', 'claude-unknown-1'])(
    'puts %j in other, since it names no family',
    (id) => {
      expect(modelFamily(id)).toBe('other')
    }
  )

  it.each(['claude-sonnets-1', 'claude-sonnet4', 'myopus-1', 'claude-opusx'])(
    'does not match a family name inside a longer word: %s',
    (id) => {
      expect(modelFamily(id)).toBe('other')
    }
  )

  it('lists the families in the order the chart stacks them, other last', () => {
    expect(FAMILIES).toEqual(['fable', 'opus', 'sonnet', 'haiku', 'other'])
  })
})
