import { describe, expect, it } from 'vitest'
import { compareCodeUnits } from '../compareCodeUnits'

describe('compareCodeUnits', () => {
  it('sorts by code unit, uppercase before lowercase', () => {
    const values = ['zeta', 'alpha', 'Beta']

    expect([...values].sort(compareCodeUnits)).toEqual(['Beta', 'alpha', 'zeta'])
  })

  it('returns 0 for equal strings', () => {
    expect(compareCodeUnits('same', 'same')).toBe(0)
  })
})
