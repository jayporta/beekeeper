import { describe, expect, it } from 'vitest'
import { isInside } from '../isInside'

describe('isInside', () => {
  it('accepts the root itself', () => {
    expect(isInside('/repo', '/repo')).toBe(true)
  })

  it('accepts a path below the root', () => {
    expect(isInside('/repo', '/repo/src/a.ts')).toBe(true)
  })

  it('refuses a sibling whose name only extends the root name', () => {
    expect(isInside('/repo', '/repo-other')).toBe(false)
  })

  it('accepts any absolute path when the root is the filesystem root', () => {
    expect(isInside('/', '/etc')).toBe(true)
  })
})
