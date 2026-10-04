import { describe, expect, it } from 'vitest'
import type { FolderTotalsState } from '../folderTotalsState'
import { areCountsPartial, isPartial, sumTotals, totalsStatus } from '../sumTotals'
import { readyTotals, testTotals } from '../testTotals'

const loading: FolderTotalsState = { status: 'loading' }
const failed: FolderTotalsState = { status: 'error', code: 'unreadable' }
const latest = (
  sessionId: string,
  latestMs: number
): { sessionId: string; title: null; latestMs: number } => ({
  sessionId,
  title: null,
  latestMs
})

describe('sumTotals', () => {
  it('is all zero for no folders', () => {
    expect(sumTotals([])).toEqual({
      ...testTotals(),
      folders: { ready: 0, loading: 0, failed: 0 },
      refreshing: false
    })
  })

  it('adds the figures of every folder with totals', () => {
    const result = sumTotals([
      readyTotals({ tokens: 100, usd: 1.5, sessions: 2, agents: 5 }),
      readyTotals({ tokens: 50, usd: 0.5, sessions: 1, agents: 2 })
    ])

    expect(result).toMatchObject({ tokens: 150, usd: 2, sessions: 3, agents: 7 })
  })

  it('adds every partial count', () => {
    const partial = (n: number): ReturnType<typeof testTotals>['partial'] => ({
      withoutTokens: n,
      withoutCost: 2 * n,
      unreadable: 3 * n,
      lowTokens: 4 * n,
      undated: 5 * n
    })

    const result = sumTotals([
      readyTotals({ partial: partial(1) }),
      readyTotals({ partial: partial(10) })
    ])

    expect(result.partial).toEqual(partial(11))
  })

  it('takes the latest session of the folder that was active last', () => {
    const result = sumTotals([
      readyTotals({ latest: latest('a', 100) }),
      readyTotals({ latest: latest('b', 300) }),
      readyTotals({ latest: latest('c', 200) })
    ])

    expect(result.latest?.sessionId).toBe('b')
  })

  it('breaks a tie between folders by session id, whatever the order', () => {
    const forward = sumTotals([
      readyTotals({ latest: latest('b', 5) }),
      readyTotals({ latest: latest('a', 5) })
    ])
    const backward = sumTotals([
      readyTotals({ latest: latest('a', 5) }),
      readyTotals({ latest: latest('b', 5) })
    ])

    expect([forward.latest?.sessionId, backward.latest?.sessionId]).toEqual(['a', 'a'])
  })

  it('skips a folder with no latest session', () => {
    const result = sumTotals([
      readyTotals(),
      readyTotals({ latest: latest('a', 1) }),
      readyTotals()
    ])

    expect(result.latest?.sessionId).toBe('a')
  })

  it('has no latest session when no folder has one', () => {
    expect(sumTotals([readyTotals(), loading]).latest).toBeNull()
  })

  it('counts folders by state, adding nothing for one still loading or that failed', () => {
    const result = sumTotals([readyTotals({ tokens: 10 }), loading, failed, loading])

    expect(result).toMatchObject({ tokens: 10, folders: { ready: 1, loading: 2, failed: 1 } })
  })

  it('is refreshing when any folder shows the other window’s figures', () => {
    expect(sumTotals([readyTotals({}, false), readyTotals({}, true)]).refreshing).toBe(true)
    expect(sumTotals([readyTotals({}, false)]).refreshing).toBe(false)
  })

  it('does not count a folder that is not ready toward refreshing', () => {
    expect(sumTotals([loading, failed]).refreshing).toBe(false)
  })
})

describe('totalsStatus', () => {
  it('is ready once any folder has totals', () => {
    expect(totalsStatus(sumTotals([loading, readyTotals(), failed]))).toBe('ready')
  })

  it('is loading while a folder loads and none has totals, even if another failed', () => {
    expect(totalsStatus(sumTotals([failed, loading]))).toBe('loading')
  })

  it('is an error when every folder failed', () => {
    expect(totalsStatus(sumTotals([failed, failed]))).toBe('error')
  })

  it('is an error for no folders at all, since there is nothing to show', () => {
    expect(totalsStatus(sumTotals([]))).toBe('error')
  })
})

describe('isPartial', () => {
  it('is false for complete totals, zero or not', () => {
    expect(isPartial(sumTotals([readyTotals({ tokens: 5 }), readyTotals()]))).toBe(false)
  })

  it.each([
    ['a folder loading', [readyTotals(), loading]],
    ['a folder that failed', [readyTotals(), failed]],
    [
      'a session with no tokens',
      [readyTotals({ partial: { ...testTotals().partial, withoutTokens: 1 } })]
    ],
    [
      'a session with no cost',
      [readyTotals({ partial: { ...testTotals().partial, withoutCost: 1 } })]
    ],
    [
      'an unreadable session',
      [readyTotals({ partial: { ...testTotals().partial, unreadable: 1 } })]
    ],
    [
      'tokens that may be low',
      [readyTotals({ partial: { ...testTotals().partial, lowTokens: 1 } })]
    ],
    ['an undated session', [readyTotals({ partial: { ...testTotals().partial, undated: 1 } })]]
  ] as const)('is true for %s', (_label, states) => {
    expect(isPartial(sumTotals(states))).toBe(true)
  })
})

describe('areCountsPartial', () => {
  it('is false for complete totals, and for sessions that only miss tokens or cost', () => {
    const gaps = { ...testTotals().partial, withoutTokens: 2, withoutCost: 2, lowTokens: 2 }

    expect(areCountsPartial(sumTotals([readyTotals({ partial: gaps })]))).toBe(false)
  })

  it.each([
    ['a folder loading', [readyTotals(), loading]],
    ['a folder that failed', [readyTotals(), failed]],
    [
      'an unreadable session',
      [readyTotals({ partial: { ...testTotals().partial, unreadable: 1 } })]
    ],
    ['an undated session', [readyTotals({ partial: { ...testTotals().partial, undated: 1 } })]]
  ] as const)('is true for %s', (_label, states) => {
    expect(areCountsPartial(sumTotals(states))).toBe(true)
  })
})
