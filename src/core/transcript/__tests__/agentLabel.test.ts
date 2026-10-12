import { describe, expect, it } from 'vitest'
import { toAgentLabel } from '../agentLabel'

/**
 * The label cap in UTF-16 code units. Kept here rather than imported from
 * `boundedLabel.ts`, and pinned by the boundary tests below.
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

  // The classes of unprintable character are covered in hasUnprintable.test.ts.
  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['an unprintable character', 'a\nb']
  ])('rejects %s', (_case, value) => {
    expect(toAgentLabel(value)).toBeNull()
  })

  it('rejects a non-string', () => {
    expect(toAgentLabel(['a'])).toBeNull()
  })
})
