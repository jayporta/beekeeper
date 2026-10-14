import { describe, expect, it } from 'vitest'
import { cutLabel, MAX_LABEL_CHARS } from '../cutLabel'

describe('cutLabel', () => {
  it('leaves a short label alone', () => {
    expect(cutLabel('Fix the bug')).toBe('Fix the bug')
  })

  it('leaves a label of exactly the limit alone', () => {
    const label = 'a'.repeat(MAX_LABEL_CHARS)

    expect(cutLabel(label)).toBe(label)
  })

  it('cuts a longer label to the limit, ending in an ellipsis', () => {
    const cut = cutLabel('a'.repeat(MAX_LABEL_CHARS + 1))

    expect([...cut]).toHaveLength(MAX_LABEL_CHARS)
    expect(cut.endsWith('…')).toBe(true)
  })

  it('counts a character outside the basic plane as one', () => {
    const cut = cutLabel('😀'.repeat(MAX_LABEL_CHARS + 5))

    expect([...cut]).toHaveLength(MAX_LABEL_CHARS)
  })
})
