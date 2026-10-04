import { describe, expect, it } from 'vitest'
import { testReport, testTokenGroup } from '../../testSessionDetail'
import { tokenBreakdown } from '../tokenBreakdown'

describe('tokenBreakdown', () => {
  it('lists input, output, cache read and cache write, in that order', () => {
    expect(tokenBreakdown(testReport()).map((row) => row.tokenClass)).toEqual([
      'input',
      'output',
      'cacheRead',
      'cacheWrite'
    ])
  })

  it('sums each class across groups, counting the cache write of both windows', () => {
    const report = testReport({
      tokenGroups: [
        testTokenGroup({ input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }),
        testTokenGroup({ input: 10, output: 20, cacheRead: 30, cacheWrite5m: 40 }, 'other')
      ]
    })

    expect(tokenBreakdown(report).map((row) => row.tokens)).toEqual([11, 22, 33, 49])
  })

  it('sizes each bar against the largest class', () => {
    const report = testReport({
      tokenGroups: [testTokenGroup({ input: 50, output: 100, cacheRead: 25 })]
    })

    expect(tokenBreakdown(report).map((row) => row.fraction)).toEqual([0.5, 1, 0.25, 0])
  })

  it('has empty bars when no tokens were used', () => {
    expect(tokenBreakdown(testReport()).map((row) => row.fraction)).toEqual([0, 0, 0, 0])
  })
})
