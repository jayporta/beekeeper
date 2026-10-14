import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../ipc/emptyAgentSignals'
import { nodeMarks } from '../nodeMarks'

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
