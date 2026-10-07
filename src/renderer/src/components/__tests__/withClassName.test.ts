import { describe, expect, it } from 'vitest'
import { withClassName } from '../withClassName'

describe('withClassName', () => {
  it('returns the base class alone when there is no extra class', () => {
    expect(withClassName('base', undefined)).toBe('base')
  })

  it('appends the extra class after the base class', () => {
    expect(withClassName('base', 'extra')).toBe('base extra')
  })

  it('returns the extra class alone when the base class is missing', () => {
    expect(withClassName(undefined, 'extra')).toBe('extra')
  })

  it('returns nothing when neither class is given', () => {
    expect(withClassName(undefined, undefined)).toBeUndefined()
  })
})
