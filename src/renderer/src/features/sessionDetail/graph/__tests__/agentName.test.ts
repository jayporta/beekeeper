import { describe, expect, it } from 'vitest'
import { testMeta } from '../../testSessionDetail'
import { agentName } from '../agentName'

const AGENT_ID = 'a1b2c3d4e5f6a7b8c'

describe('agentName', () => {
  it('prefers the name over the description and the type', () => {
    const meta = testMeta({ name: 'researcher', description: 'look around', agentType: 'Explore' })

    expect(agentName(meta, AGENT_ID)).toBe('researcher')
  })

  it('falls back to the description when there is no name', () => {
    const meta = testMeta({ description: 'look around', agentType: 'Explore' })

    expect(agentName(meta, AGENT_ID)).toBe('look around')
  })

  it('falls back to the type when there is no name or description', () => {
    expect(agentName(testMeta({ agentType: 'Explore' }), AGENT_ID)).toBe('Explore')
  })

  it('treats a blank name or description as absent', () => {
    const meta = testMeta({ name: '  ', description: '', agentType: 'Explore' })

    expect(agentName(meta, AGENT_ID)).toBe('Explore')
  })

  it('falls back to the type for a fork with no name', () => {
    expect(agentName(testMeta({ agentType: 'fork', isFork: true }), AGENT_ID)).toBe('fork')
  })

  it('uses the first characters of the agent id when the meta is absent', () => {
    expect(agentName({ status: 'absent' }, AGENT_ID)).toBe('a1b2c3d4')
  })

  it('uses the first characters of the agent id when the meta could not be read', () => {
    expect(agentName({ status: 'error', reason: 'invalid-json' }, AGENT_ID)).toBe('a1b2c3d4')
  })

  it('uses a short agent id whole', () => {
    expect(agentName({ status: 'absent' }, 'a1')).toBe('a1')
  })
})
