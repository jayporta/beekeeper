import { describe, expect, it } from 'vitest'
import { findPublishProblems } from '../modPublishOrder.mjs'

describe('findPublishProblems', () => {
  it('allows the first publish, when the branch holds nothing', () => {
    expect(findPublishProblems('0.1.0', undefined)).toEqual([])
  })

  it.each([
    ['patch', '0.1.1', '0.1.0'],
    ['minor', '0.2.0', '0.1.9'],
    ['major', '1.0.0', '0.9.9']
  ])('allows a newer %s version', (_part, version, published) => {
    expect(findPublishProblems(version, published)).toEqual([])
  })

  it('compares each part as a number, not as text', () => {
    expect(findPublishProblems('0.10.0', '0.9.0')).toEqual([])
    expect(findPublishProblems('0.9.0', '0.10.0')).toHaveLength(1)
  })

  it('compares parts too large for a double exactly', () => {
    expect(findPublishProblems('0.0.9007199254740993', '0.0.9007199254740992')).toEqual([])
    expect(findPublishProblems('0.0.9007199254740992', '0.0.9007199254740993')).toHaveLength(1)
  })

  it('refuses the version the branch already holds', () => {
    const problems = findPublishProblems('0.1.0', '0.1.0')

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('0.1.0')
  })

  it('refuses an older version, which would roll installs back', () => {
    const problems = findPublishProblems('0.1.0', '0.2.0')

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('0.1.0')
    expect(problems[0]).toContain('0.2.0')
  })

  it.each(['0.2.0-rc.1', '0.2.0+build.5', 'v0.2.0', '0.2', '01.2.3', '', 'undefined'])(
    'refuses %j, which is not a release version',
    (version) => {
      expect(findPublishProblems(version, '0.1.0')).toHaveLength(1)
    }
  )

  it('refuses a prerelease even on the first publish', () => {
    expect(findPublishProblems('0.1.0-rc.1', undefined)).toHaveLength(1)
  })

  it('refuses when the branch holds a version it cannot compare against', () => {
    const problems = findPublishProblems('0.2.0', 'undefined')

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('undefined')
  })
})
