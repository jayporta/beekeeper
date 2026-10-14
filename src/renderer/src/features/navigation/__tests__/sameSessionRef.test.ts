import { describe, expect, it } from 'vitest'
import { sameSessionRef } from '../sameSessionRef'

const ref = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }

describe('sameSessionRef', () => {
  it('matches refs with the same folder and session id', () => {
    expect(sameSessionRef(ref, { ...ref })).toBe(true)
  })

  it('tells two sessions in one folder apart', () => {
    expect(sameSessionRef(ref, { ...ref, sessionId: 'other' })).toBe(false)
  })

  it('tells one session id in two folders apart', () => {
    expect(sameSessionRef(ref, { ...ref, projectDirName: '-Users-a-other' })).toBe(false)
  })

  it('matches an absent ref only with another absent one', () => {
    expect(sameSessionRef(null, null)).toBe(true)
    expect(sameSessionRef(null, ref)).toBe(false)
    expect(sameSessionRef(ref, null)).toBe(false)
  })
})
