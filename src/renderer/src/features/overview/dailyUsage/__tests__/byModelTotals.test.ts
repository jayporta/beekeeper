import { describe, expect, it } from 'vitest'
import { byModelTotals } from '../byModelTotals'
import type { Series } from '../seriesOf'

const series = (...entries: [Series['key'], number][]): Series[] =>
  entries.map(([key, total]) => ({ key, total }))

describe('byModelTotals', () => {
  it('has a row per series, in the series order, with its tokens', () => {
    const rows = byModelTotals(series(['opus', 60], ['haiku', 40]), 100)

    expect(rows.map((row) => [row.key, row.tokens])).toEqual([
      ['opus', 60],
      ['haiku', 40]
    ])
  })

  it('gives each row its rounded percent of the total', () => {
    const rows = byModelTotals(series(['opus', 2], ['sonnet', 1]), 3)

    expect(rows.map((row) => row.percent)).toEqual([67, 33])
  })

  it('gives its fraction of the total for drawing', () => {
    expect(byModelTotals(series(['opus', 1]), 4)[0]?.fraction).toBe(0.25)
  })

  it('is one full share for a single family', () => {
    expect(byModelTotals(series(['opus', 7]), 7)).toEqual([
      { key: 'opus', tokens: 7, fraction: 1, percent: 100, underOne: false }
    ])
  })

  it('flags a family under one percent, which still has a fraction to draw', () => {
    const [big, tiny] = byModelTotals(series(['opus', 996], ['haiku', 4]), 1000)

    expect(tiny).toMatchObject({ percent: 0, underOne: true, fraction: 0.004 })
    expect(big?.underOne).toBe(false)
  })

  it('is zero, never NaN or Infinity, when the total is zero', () => {
    const rows = byModelTotals(series(['opus', 0]), 0)

    expect(rows).toEqual([{ key: 'opus', tokens: 0, fraction: 0, percent: 0, underOne: false }])
  })

  it('has no rows for no series', () => {
    expect(byModelTotals([], 0)).toEqual([])
  })
})
