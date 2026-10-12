import { describe, expect, it } from 'vitest'
import { projectColorSlot } from '../projectColorSlot'

describe('projectColorSlot', () => {
  it.each([
    [0, 1],
    [8, 9],
    [9, 1],
    [17, 9],
    [20, 3]
  ] as const)('gives index %s slot %s, cycling through the nine slots', (index, slot) => {
    expect(projectColorSlot(index)).toBe(slot)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s, which is not a position in the list',
    (index) => {
      expect(() => projectColorSlot(index)).toThrow(RangeError)
    }
  )
})
