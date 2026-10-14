import { describe, expect, it } from 'vitest'
import { findVersionProblems } from '../modVersion.mjs'

describe('findVersionProblems', () => {
  it('finds no problem when the mod and the app share a version', () => {
    expect(findVersionProblems({ version: '0.1.0' }, { version: '0.1.0' })).toEqual([])
  })

  it('names both versions when they differ', () => {
    const problems = findVersionProblems({ version: '0.2.0' }, { version: '0.1.0' })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('0.1.0')
    expect(problems[0]).toContain('0.2.0')
  })

  it('treats a version that differs only in a suffix as different', () => {
    expect(findVersionProblems({ version: '0.1.0' }, { version: '0.1.0-rc.1' })).toHaveLength(1)
  })

  it('reports a plugin.json without a version', () => {
    const problems = findVersionProblems({ version: '0.1.0' }, { name: 'beekeeper' })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('plugin.json')
  })

  it('reports a package.json without a version', () => {
    const problems = findVersionProblems({ name: 'beekeeper' }, { version: '0.1.0' })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('package.json')
  })

  it('reports a version that is not a string', () => {
    expect(findVersionProblems({ version: '0.1.0' }, { version: 1 })).toHaveLength(1)
  })

  it('reports an empty version', () => {
    expect(findVersionProblems({ version: '' }, { version: '' })).not.toEqual([])
  })

  it('reports a file that is not an object', () => {
    expect(findVersionProblems(null, [])).toHaveLength(2)
  })
})
