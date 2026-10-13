import { describe, expect, it } from 'vitest'
import { testReport, testTokenGroup } from '../../testSessionDetail'
import { tokenClasses } from '../tokenClasses'

describe('tokenClasses', () => {
  it('lists the four classes in order, with zero for each when there are no reports', () => {
    expect(tokenClasses([])).toEqual([
      { tokenClass: 'input', tokens: 0 },
      { tokenClass: 'output', tokens: 0 },
      { tokenClass: 'cacheRead', tokens: 0 },
      { tokenClass: 'cacheWrite', tokens: 0 }
    ])
  })

  it('adds both cache write windows into one class', () => {
    const report = testReport({
      tokenGroups: [testTokenGroup({ cacheWrite5m: 3, cacheWrite1h: 4 })]
    })

    expect(tokenClasses([report]).find((c) => c.tokenClass === 'cacheWrite')?.tokens).toBe(7)
  })

  it('sums every model of every report', () => {
    const a = testReport({
      tokenGroups: [testTokenGroup({ input: 1 }), testTokenGroup({ input: 2 })]
    })
    const b = testReport({ tokenGroups: [testTokenGroup({ input: 4, output: 8 })] })

    expect(tokenClasses([a, b]).map((c) => c.tokens)).toEqual([7, 8, 0, 0])
  })
})
