import { describe, expect, it } from 'vitest'
import { hasUnprintable } from '../hasUnprintable'
import { replaceUnprintable } from '../replaceUnprintable'

describe('replaceUnprintable', () => {
  it.each([
    ['a control character', 'a\u0007b'],
    ['a newline', 'a\nb'],
    ['a tab', 'a\tb'],
    ['a bidi override', 'a‮b'],
    ['a line separator', 'a b'],
    ['a non-breaking space', 'a b'],
    ['a lone surrogate', 'a\uD800b'],
    ['a private-use character', 'ab']
  ])('turns %s into a space', (_label, value) => {
    expect(replaceUnprintable(value)).toBe('a b')
  })

  it('replaces every occurrence, not only the first', () => {
    expect(replaceUnprintable('a\nb\nc\u0007d')).toBe('a b c d')
  })

  it('leaves printable text unchanged', () => {
    expect(replaceUnprintable('café 😀 a b')).toBe('café 😀 a b')
  })

  it('returns a string that hasUnprintable accepts', () => {
    expect(hasUnprintable(replaceUnprintable('x‮\n\uD800 y'))).toBe(false)
  })

  it('answers the empty string for the empty string', () => {
    expect(replaceUnprintable('')).toBe('')
  })
})
