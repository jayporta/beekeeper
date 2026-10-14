import { describe, expect, it } from 'vitest'
import { cutLabel, labelRoom, MAX_LABEL_CHARS, MIN_LABEL_CHARS } from '../cutLabel'

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

  it('cuts to the room given instead of the default', () => {
    expect([...cutLabel('a'.repeat(100), 20)]).toHaveLength(20)
  })
})

describe('labelRoom', () => {
  it('is the width less what the row needs besides the label', () => {
    expect(labelRoom({ columns: 80, reserved: 30 })).toBe(50)
  })

  it('never goes below the least a label keeps, however narrow the pane', () => {
    expect(labelRoom({ columns: 20, reserved: 40 })).toBe(MIN_LABEL_CHARS)
  })

  it('is the fixed limit when the width is unknown', () => {
    expect(labelRoom({ columns: undefined, reserved: 30 })).toBe(MAX_LABEL_CHARS)
  })
})
