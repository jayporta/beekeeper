import { describe, expect, it } from 'vitest'
import { isSupportedGitVersion, parseGitVersion } from '../gitVersion'

describe('parseGitVersion', () => {
  it('parses an Apple git version line', () => {
    expect(parseGitVersion('git version 2.39.5 (Apple Git-154)\n')).toEqual({ major: 2, minor: 39 })
  })

  it('parses a plain version line', () => {
    expect(parseGitVersion('git version 2.34.1')).toEqual({ major: 2, minor: 34 })
  })

  it('returns undefined for unrecognized text', () => {
    expect(parseGitVersion('hello')).toBeUndefined()
    expect(parseGitVersion('')).toBeUndefined()
  })
})

describe('isSupportedGitVersion', () => {
  it.each([
    [{ major: 2, minor: 44 }, true],
    [{ major: 2, minor: 43 }, false],
    [{ major: 3, minor: 0 }, true],
    [{ major: 1, minor: 99 }, false]
  ])('%j is supported: %s', (version, expected) => {
    expect(isSupportedGitVersion(version)).toBe(expected)
  })
})
