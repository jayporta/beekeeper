import { describe, expect, it } from 'vitest'
import { truncateTitle } from '../truncateTitle'

/** A character outside the Basic Multilingual Plane, so two UTF-16 code units. */
const BEE = '\u{1F41D}'

describe('truncateTitle', () => {
  it('returns a title shorter than the cap unchanged', () => {
    expect(truncateTitle('Fix the flaky test')).toBe('Fix the flaky test')
  })

  it('returns a title exactly at the cap unchanged', () => {
    const title = 'a'.repeat(200)

    expect(truncateTitle(title)).toBe(title)
  })

  it('caps a title one code unit past the cap', () => {
    expect(truncateTitle('a'.repeat(201))).toBe('a'.repeat(200))
  })

  it('drops a trailing high surrogate rather than cutting a pair in half', () => {
    const capped = truncateTitle(`a${BEE.repeat(300)}`)

    expect(capped).toBe(`a${BEE.repeat(99)}`)
  })

  it('keeps a pair that ends exactly on the cap', () => {
    const capped = truncateTitle(BEE.repeat(300))

    expect(capped).toBe(BEE.repeat(100))
  })

  it('leaves no unpaired surrogate at the cut', () => {
    const capped = truncateTitle(`a${BEE.repeat(300)}`)

    expect(capped).toBe(capped.toWellFormed())
  })

  it('caps a title far larger than any real one', () => {
    // The reader admits lines up to 64 Mi code units, so the cap has to
    // hold for a title orders of magnitude past anything a session writes.
    expect(truncateTitle('a'.repeat(5_000_000))).toBe('a'.repeat(200))
  })
})
