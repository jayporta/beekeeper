import { describe, expect, it } from 'vitest'
import { countedUsage } from '../countedUsage'
import { emptyTokenCounts } from '../tokenCounts'

const tokens = { ...emptyTokenCounts, input: 3, output: 4 }

describe('countedUsage', () => {
  it('normalizes the model and totals every class', () => {
    expect(countedUsage({ model: 'claude-opus-5-20260101', tokens })).toEqual({
      model: 'claude-opus-5',
      tokens: 7
    })
  })

  it('leaves out the synthetic model', () => {
    expect(countedUsage({ model: '<synthetic>', tokens })).toBeNull()
  })

  it('leaves out a message with no tokens', () => {
    expect(countedUsage({ model: 'claude-opus-5', tokens: emptyTokenCounts })).toBeNull()
  })

  it('leaves out a non-finite total', () => {
    expect(
      countedUsage({ model: 'claude-opus-5', tokens: { ...tokens, input: Infinity } })
    ).toBeNull()
  })
})
