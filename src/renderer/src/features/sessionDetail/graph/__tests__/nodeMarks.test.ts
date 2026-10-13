import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import { markLabels, nodeMarks } from '../nodeMarks'
import { testGraphT } from '../testGraphT'

describe('nodeMarks', () => {
  it('takes the tool error and compaction counts and the error streak from the signals', () => {
    const signals = {
      ...EMPTY_AGENT_SIGNALS_DTO,
      toolErrors: 12,
      compactions: 2,
      agentsKilled: 5,
      longestErrorStreak: 4
    }

    expect(nodeMarks(signals)).toEqual({ toolErrors: 12, compactions: 2, longestErrorStreak: 4 })
  })
})

describe('markLabels', () => {
  it('shows tool errors alone when there are no compactions', () => {
    expect(
      markLabels({ toolErrors: 12, compactions: 0, longestErrorStreak: 0 }, testGraphT)
    ).toEqual(['×12'])
  })

  it('shows compactions alone when there are no tool errors', () => {
    expect(
      markLabels({ toolErrors: 0, compactions: 3, longestErrorStreak: 0 }, testGraphT)
    ).toEqual(['▲3'])
  })

  it('shows tool errors before compactions', () => {
    expect(
      markLabels({ toolErrors: 1, compactions: 3, longestErrorStreak: 0 }, testGraphT)
    ).toEqual(['×1', '▲3'])
  })

  it('shows nothing for zero counts or for no marks', () => {
    expect(
      markLabels({ toolErrors: 0, compactions: 0, longestErrorStreak: 0 }, testGraphT)
    ).toEqual([])
    expect(markLabels(null, testGraphT)).toEqual([])
  })
})
