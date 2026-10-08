import { describe, expect, it } from 'vitest'
import { MAX_SERIES, seriesOf, seriesTokens } from '../seriesOf'
import type { DailyUsageDay } from '../sumDailyUsage'

function day(byModel: Record<string, number>): DailyUsageDay {
  const models = new Map(Object.entries(byModel))
  return {
    day: '2026-03-10',
    byModel: models,
    total: [...models.values()].reduce((a, b) => a + b, 0)
  }
}

describe('seriesOf', () => {
  it('has one series per model, largest first, and no other series, for up to four models', () => {
    const series = seriesOf([day({ a: 1, b: 3, c: 2 })])

    expect(series.map((s) => [s.key, s.index, s.total])).toEqual([
      [{ kind: 'model', model: 'b' }, 0, 3],
      [{ kind: 'model', model: 'c' }, 1, 2],
      [{ kind: 'model', model: 'a' }, 2, 1]
    ])
  })

  it('ranks a model by its total over every day', () => {
    const series = seriesOf([day({ a: 5, b: 1 }), day({ a: 0, b: 9 })])

    expect(series.map((s) => s.key)).toEqual([
      { kind: 'model', model: 'b' },
      { kind: 'model', model: 'a' }
    ])
  })

  it('folds the models past the top four into one other series holding the remainder', () => {
    const series = seriesOf([day({ a: 60, b: 50, c: 40, d: 30, e: 20, f: 10 })])

    expect(MAX_SERIES).toBe(4)
    expect(series).toHaveLength(5)
    expect(series.at(-1)).toEqual({ key: { kind: 'other' }, index: MAX_SERIES, total: 30 })
    expect(series.slice(0, 4).map((s) => s.index)).toEqual([0, 1, 2, 3])
  })

  it('has no other series for exactly four models', () => {
    expect(seriesOf([day({ a: 4, b: 3, c: 2, d: 1 })])).toHaveLength(4)
  })

  it('breaks a tie by model id', () => {
    const series = seriesOf([day({ b: 5, a: 5, c: 5 })])

    expect(series.map((s) => s.key)).toEqual([
      { kind: 'model', model: 'a' },
      { kind: 'model', model: 'b' },
      { kind: 'model', model: 'c' }
    ])
  })

  it('has no series for no usage', () => {
    expect(seriesOf([])).toEqual([])
    expect(seriesOf([day({})])).toEqual([])
  })
})

describe('seriesTokens', () => {
  const days = [day({ a: 60, b: 50, c: 40, d: 30, e: 20, f: 10 }), day({ a: 1, f: 2 })]
  const all = seriesOf(days)

  it('is a model series’ tokens that day, or zero', () => {
    const b = all[1]
    if (b === undefined) throw new Error('expected a series')

    expect(seriesTokens({ day: days[0] as DailyUsageDay, series: b, all })).toBe(50)
    expect(seriesTokens({ day: days[1] as DailyUsageDay, series: b, all })).toBe(0)
  })

  it('is the other series’ tokens that day: the models outside the top four', () => {
    const other = all.at(-1)
    if (other === undefined) throw new Error('expected a series')

    expect(seriesTokens({ day: days[0] as DailyUsageDay, series: other, all })).toBe(30)
    expect(seriesTokens({ day: days[1] as DailyUsageDay, series: other, all })).toBe(2)
  })
})
