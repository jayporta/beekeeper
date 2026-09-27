import { describe, expect, it } from 'vitest'
import { detachFromParent } from '../detachFromParent'

describe('detachFromParent', () => {
  it('returns an equal string', () => {
    expect(detachFromParent('scout 🐝')).toBe('scout 🐝')
  })

  it('returns an empty string for an empty one', () => {
    expect(detachFromParent('')).toBe('')
  })
})
