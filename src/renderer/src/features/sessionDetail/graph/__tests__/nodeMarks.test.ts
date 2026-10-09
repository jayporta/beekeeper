import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import { hasMarks, markLabels, nodeMarks } from '../nodeMarks'
import { testGraphT } from '../testGraphT'

describe('nodeMarks', () => {
  it('takes the tool error and compaction counts from the signals', () => {
    const signals = { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 12, compactions: 2, agentsKilled: 5 }

    expect(nodeMarks(signals)).toEqual({ toolErrors: 12, compactions: 2 })
  })
})

describe('markLabels', () => {
  it('shows tool errors alone when there are no compactions', () => {
    expect(markLabels({ toolErrors: 12, compactions: 0 }, testGraphT)).toEqual(['×12'])
  })

  it('shows compactions alone when there are no tool errors', () => {
    expect(markLabels({ toolErrors: 0, compactions: 3 }, testGraphT)).toEqual(['▲3'])
  })

  it('shows tool errors before compactions', () => {
    expect(markLabels({ toolErrors: 1, compactions: 3 }, testGraphT)).toEqual(['×1', '▲3'])
  })

  it('shows nothing for zero counts or for no marks', () => {
    expect(markLabels({ toolErrors: 0, compactions: 0 }, testGraphT)).toEqual([])
    expect(markLabels(null, testGraphT)).toEqual([])
  })
})

describe('hasMarks', () => {
  it('is true when either count is above zero', () => {
    expect(hasMarks({ toolErrors: 1, compactions: 0 })).toBe(true)
    expect(hasMarks({ toolErrors: 0, compactions: 1 })).toBe(true)
  })

  it('is false for zero counts and for no marks', () => {
    expect(hasMarks({ toolErrors: 0, compactions: 0 })).toBe(false)
    expect(hasMarks(null)).toBe(false)
  })
})
