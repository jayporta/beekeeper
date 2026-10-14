import { describe, expect, it } from 'vitest'
import { COUNT_REASONS, countReasonsOf, figuresMarkedBy } from '../countReasons'
import { FIGURES_AFFECTED_BY_COUNT } from '../countReasons'

const NONE = {
  withoutTokens: 0,
  withoutCost: 0,
  unreadable: 0,
  lowTokens: 0,
  uncountedSubagents: 0,
  undated: 0
}

describe('countReasonsOf', () => {
  it('is empty when every count is zero', () => {
    expect(countReasonsOf(NONE)).toEqual([])
  })

  it('gives the reasons with a count, in footnote order', () => {
    expect(countReasonsOf({ ...NONE, undated: 1, unreadable: 2, withoutCost: 1 })).toEqual([
      'unreadable',
      'withoutCost',
      'undated'
    ])
  })

  it('knows every reason', () => {
    expect(
      countReasonsOf({ ...NONE, ...Object.fromEntries(COUNT_REASONS.map((r) => [r, 1])) })
    ).toEqual(COUNT_REASONS)
  })
})

describe('figuresMarkedBy', () => {
  it('marks nothing for no reasons', () => {
    expect(figuresMarkedBy([], FIGURES_AFFECTED_BY_COUNT)).toEqual({
      tokens: false,
      cost: false,
      sessions: false,
      agents: false
    })
  })

  it('marks only the figure a reason names', () => {
    expect(figuresMarkedBy(['withoutCost'], FIGURES_AFFECTED_BY_COUNT)).toEqual({
      tokens: false,
      cost: true,
      sessions: false,
      agents: false
    })
  })

  it('marks every figure for an unreadable session', () => {
    expect(figuresMarkedBy(['unreadable'], FIGURES_AFFECTED_BY_COUNT)).toEqual({
      tokens: true,
      cost: true,
      sessions: true,
      agents: true
    })
  })
})
