import { describe, expect, it } from 'vitest'
import { toAgentLabel } from '../agentLabel'

/**
 * The label cap in UTF-16 code units. Kept here rather than exported from
 * `agentLabel.ts`, and pinned by the boundary tests below.
 */
const CAP = 256

describe('toAgentLabel', () => {
  it('keeps a plain label', () => {
    expect(toAgentLabel('scout')).toBe('scout')
  })

  it('keeps a value of exactly the cap', () => {
    expect(toAgentLabel('x'.repeat(CAP))).toBe('x'.repeat(CAP))
  })

  it('rejects a value one code unit over the cap', () => {
    expect(toAgentLabel('x'.repeat(CAP + 1))).toBeNull()
  })

  it('rejects a value that NFC normalization expands past the cap', () => {
    // U+0344 is excluded from composition and expands to two code units.
    expect(toAgentLabel('̈́'.repeat(CAP))).toBeNull()
  })

  it('trims surrounding whitespace', () => {
    expect(toAgentLabel('  scout  ')).toBe('scout')
  })

  it('normalizes to NFC', () => {
    expect(toAgentLabel('é')).toBe('é')
  })

  it('keeps an interior plain space', () => {
    expect(toAgentLabel('a b')).toBe('a b')
  })

  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['a control character', 'a\nb'],
    ['a format character (bidi override)', 'a‮b'],
    ['a lone surrogate', 'a\ud800b'],
    ['a private-use code point', 'ab'],
    ['a non-breaking space', 'a b'],
    ['a line separator', 'a b'],
    ['an interior tab', 'a\tb']
  ])('rejects %s', (_case, value) => {
    expect(toAgentLabel(value)).toBeNull()
  })

  it.each([[42], [null], [undefined], [{}], [['a']]])('rejects a non-string: %j', (value) => {
    expect(toAgentLabel(value)).toBeNull()
  })
})
