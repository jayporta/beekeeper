import { describe, expect, it } from 'vitest'
import { splitTeamSuffix } from '../splitTeamSuffix'

/** The gate's own cap, in UTF-16 code units, pinned by the boundary tests below. */
const CAP = 256

describe('splitTeamSuffix', () => {
  it('splits at the last @', () => {
    expect(splitTeamSuffix('a@b@team')).toEqual({ name: 'a@b', team: 'team' })
  })

  it('returns a null team when there is no @', () => {
    expect(splitTeamSuffix('scout')).toEqual({ name: 'scout', team: null })
  })

  it('returns an empty team for a trailing @', () => {
    expect(splitTeamSuffix('scout@')).toEqual({ name: 'scout', team: '' })
  })

  it('splits a value of exactly the cap', () => {
    const value = `${'n'.repeat(CAP - 2)}@t`

    expect(splitTeamSuffix(value)?.team).toBe('t')
  })

  it('returns null for a value one code unit over the cap', () => {
    expect(splitTeamSuffix(`${'n'.repeat(CAP - 1)}@t`)).toBeNull()
  })
})
