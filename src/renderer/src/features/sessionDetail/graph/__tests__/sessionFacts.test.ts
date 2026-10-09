import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import { testSession } from '@renderer/features/sessions/testSessionFixtures'
import { sessionFacts } from '../sessionFacts'

describe('sessionFacts marks', () => {
  it('counts tool errors and compactions from the summary signals', () => {
    const signals = { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 3, compactions: 1, agentsKilled: 9 }

    expect(sessionFacts(testSession(1, { signals })).marks).toEqual({
      toolErrors: 3,
      compactions: 1
    })
  })

  it('has no marks for a session whose summary could not be read', () => {
    expect(sessionFacts(testSession(1, { unreadable: true })).marks).toBeNull()
  })

  it('has no marks for a session that is not in the list', () => {
    expect(sessionFacts(null).marks).toBeNull()
  })
})

describe('sessionFacts partial', () => {
  it('is partial when the summary signals hit the cap', () => {
    const signals = { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 3, partial: true }

    expect(sessionFacts(testSession(1, { signals })).partial).toBe(true)
  })

  it('is not partial for a fully read summary with full signals', () => {
    expect(sessionFacts(testSession(1)).partial).toBe(false)
  })
})
