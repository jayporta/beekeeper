import { describe, expect, it } from 'vitest'
import { sessionLabelWords } from '../sessionLabelWords'
import { testSessionsT } from '../testSessionsT'

describe('sessionLabelWords', () => {
  const words = sessionLabelWords(testSessionsT)

  it('names a session with no title', () => {
    expect(words.untitled).toBe('Untitled session')
  })

  it('names a session that cannot be read', () => {
    expect(words.unreadable).toBe('Unreadable session')
  })

  it('names a teammate by its agent name and type', () => {
    expect(words.agentName('reviewer', 'code')).toBe('reviewer (code)')
  })
})
