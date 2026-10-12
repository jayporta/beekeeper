import { describe, expect, it } from 'vitest'
import type { AgentSignals } from '../../../core/transcript/signals/agentSignals'
import { mapAgentSignals } from '../mapAgentSignals'

const SIGNALS: AgentSignals = {
  toolErrors: 12,
  longestErrorStreak: 4,
  longestBashRepeat: 3,
  compactions: 2,
  agentsKilled: 1,
  longestToolWait: { ms: 90_000, tool: 'Bash' },
  partial: true
}

describe('mapAgentSignals', () => {
  it('copies every signal field', () => {
    expect(mapAgentSignals(SIGNALS)).toEqual(SIGNALS)
  })

  it('copies the longest wait as a new object', () => {
    expect(mapAgentSignals(SIGNALS).longestToolWait).not.toBe(SIGNALS.longestToolWait)
  })

  it('maps no wait to null', () => {
    expect(mapAgentSignals({ ...SIGNALS, longestToolWait: null }).longestToolWait).toBeNull()
  })

  it('drops fields the DTO does not name', () => {
    const withExtra = { ...SIGNALS, futureField: 'x' } as AgentSignals

    expect(Object.keys(mapAgentSignals(withExtra))).not.toContain('futureField')
  })
})
