import { describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { sessionLabel, type SessionLabel } from '../sessionLabel'
import { testAgentRole, testSession } from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const labelOf = (item: SessionListItemDto): SessionLabel => sessionLabel(item, testSessionsT)

describe('sessionLabel', () => {
  it('uses the title for a session that has one', () => {
    expect(labelOf(testSession(1, { title: 'Fix bug' }))).toEqual({
      text: 'Fix bug',
      idHint: null
    })
  })

  it('uses a placeholder and the short id for an untitled session', () => {
    expect(labelOf(testSession(12))).toEqual({ text: 'Untitled session', idHint: '00000012' })
  })

  it('uses a placeholder and the short id for an unreadable session', () => {
    expect(labelOf(testSession(12, { unreadable: true }))).toEqual({
      text: 'Unreadable session',
      idHint: '00000012'
    })
  })

  it('names a teammate by agent name and type, ignoring its title', () => {
    const item = testSession(1, { title: 'ignored', role: testAgentRole('reviewer', 'code') })

    expect(labelOf(item)).toEqual({ text: 'reviewer (code)', idHint: null })
  })

  it('falls back to whichever of name and type is present, then the short id', () => {
    expect(labelOf(testSession(1, { role: testAgentRole('reviewer', null) })).text).toBe('reviewer')
    expect(labelOf(testSession(1, { role: testAgentRole(null, 'code') })).text).toBe('code')
    expect(labelOf(testSession(1, { role: testAgentRole(null, null) })).text).toBe('00000001')
  })
})
