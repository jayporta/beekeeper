import { describe, expect, it } from 'vitest'
import { foldLabel, foldTeamKey } from '../teamKey'

describe('foldLabel', () => {
  it('folds case differences to the same key', () => {
    expect(foldLabel('Scout')).toBe(foldLabel('scout'))
  })

  it('folds a precomposed and a decomposed spelling to the same key', () => {
    expect(foldLabel('café')).toBe(foldLabel('café'))
  })

  it('folds an accented spelling to the same key as its unaccented one', () => {
    expect(foldLabel('café')).toBe(foldLabel('cafe'))
  })

  it('folds an NFKC-equivalent compatibility spelling to the same key', () => {
    expect(foldLabel('ﬁnance')).toBe(foldLabel('finance'))
  })

  it('does not fold visually similar characters from a different script', () => {
    // Cyrillic а (U+0430) versus Latin a.
    expect(foldLabel('scаut')).not.toBe(foldLabel('scaut'))
  })

  it('keeps distinct labels apart', () => {
    expect(foldLabel('scout')).not.toBe(foldLabel('scouts'))
  })
})

describe('foldTeamKey', () => {
  it('never collides a (team, name) pair with a differently split one', () => {
    expect(foldTeamKey('ab', 'c')).not.toBe(foldTeamKey('a', 'bc'))
  })

  it('folds both parts of the pair', () => {
    expect(foldTeamKey('Scout', 'Reviewer')).toBe(foldTeamKey('scout', 'reviewer'))
  })
})
