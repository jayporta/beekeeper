import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../ipc/emptyAgentSignals'
import { hasMarks, nodeMarks } from '../nodeMarks'

describe('nodeMarks', () => {
  it('takes the tool error and compaction counts from the signals', () => {
    const signals = { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 12, compactions: 2, agentsKilled: 5 }

    expect(nodeMarks(signals)).toEqual({ toolErrors: 12, compactions: 2 })
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
