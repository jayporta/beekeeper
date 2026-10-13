import { describe, expect, it } from 'vitest'
import { useExpandedSessionsStore } from '../state/useExpandedSessionsStore'

describe('useExpandedSessionsStore', () => {
  it('has no choice for a session until a person makes one', () => {
    expect(useExpandedSessionsStore.getState().expanded['-p/a']).toBeUndefined()
  })

  it('flips the state a row shows, so a row that was open closes', () => {
    useExpandedSessionsStore.getState().toggle('-p/a', true)

    expect(useExpandedSessionsStore.getState().expanded['-p/a']).toBe(false)
  })

  it('flips a row that was closed to open', () => {
    useExpandedSessionsStore.getState().toggle('-p/a', false)

    expect(useExpandedSessionsStore.getState().expanded['-p/a']).toBe(true)
  })

  it("keeps each session's choice apart", () => {
    useExpandedSessionsStore.getState().toggle('-p/a', false)

    expect(useExpandedSessionsStore.getState().expanded['-p/b']).toBeUndefined()
  })
})
