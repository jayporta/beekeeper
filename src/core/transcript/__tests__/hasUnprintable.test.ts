import { describe, expect, it } from 'vitest'
import { hasUnprintable } from '../hasUnprintable'

describe('hasUnprintable', () => {
  it.each([
    ['a control character', 'a\u0007b'],
    ['a newline', 'a\nb'],
    ['a bidi override', 'a\u202Eb'],
    ['a line separator', 'a\u2028b'],
    ['a non-breaking space', 'a\u00A0b'],
    ['a lone surrogate', 'a\uD800b'],
    ['a private-use character', 'a\uE000b']
  ])('flags %s', (_label, value) => {
    expect(hasUnprintable(value)).toBe(true)
  })

  it.each([
    ['plain text', 'claude-opus-5'],
    ['a plain space', 'a b'],
    ['an accented letter', 'café'],
    ['an emoji', 'a\u{1F600}b'],
    ['the empty string', '']
  ])('accepts %s', (_label, value) => {
    expect(hasUnprintable(value)).toBe(false)
  })
})
