import { describe, expect, it } from 'vitest'
import { seriesOf, seriesTokens } from '../seriesOf'
import type { DailyUsageDay } from '../../../../../../shared/overview/sumDailyUsage'

function day(byModel: Record<string, number>): DailyUsageDay {
  const models = new Map(Object.entries(byModel))
  return {
    day: '2026-03-10',
    byModel: models,
    total: [...models.values()].reduce((a, b) => a + b, 0)
  }
}

describe('seriesOf', () => {
  it('has one series per family with tokens, in the fixed order fable, opus, sonnet, haiku, other', () => {
    const series = seriesOf([
      day({ 'claude-haiku-5': 4, mystery: 1, 'claude-opus-5': 2, 'claude-sonnet-5': 3, fable: 5 })
    ])

    expect(series.map((s) => [s.key, s.total])).toEqual([
      ['fable', 5],
      ['opus', 2],
      ['sonnet', 3],
      ['haiku', 4],
      ['other', 1]
    ])
  })

  it('sums the models of a family over every day', () => {
    const series = seriesOf([
      day({ 'claude-opus-4': 5, 'claude-opus-5': 1 }),
      day({ 'claude-opus-5': 9 })
    ])

    expect(series).toEqual([{ key: 'opus', total: 15 }])
  })

  it('keeps the order when a larger family comes later', () => {
    const series = seriesOf([day({ 'claude-opus-5': 1, 'claude-haiku-5': 99 })])

    expect(series.map((s) => s.key)).toEqual(['opus', 'haiku'])
  })

  it('leaves out a family with no tokens', () => {
    expect(seriesOf([day({ 'claude-opus-5': 0, 'claude-haiku-5': 3 })]).map((s) => s.key)).toEqual([
      'haiku'
    ])
  })

  it('has no series for no usage', () => {
    expect(seriesOf([])).toEqual([])
    expect(seriesOf([day({})])).toEqual([])
  })
})

describe('seriesTokens', () => {
  const days = [day({ 'claude-opus-4': 6, 'claude-opus-5': 4, 'claude-haiku-5': 2 }), day({ x: 7 })]
  const [opus, haiku, other] = seriesOf(days)

  it('sums a day’s models of the family', () => {
    if (opus === undefined) throw new Error('expected a series')

    expect(seriesTokens({ day: days[0] as DailyUsageDay, series: opus })).toBe(10)
  })

  it('is zero on a day with none of the family', () => {
    if (haiku === undefined) throw new Error('expected a series')

    expect(seriesTokens({ day: days[1] as DailyUsageDay, series: haiku })).toBe(0)
  })

  it('counts a model outside every family in other', () => {
    if (other === undefined) throw new Error('expected a series')

    expect(seriesTokens({ day: days[1] as DailyUsageDay, series: other })).toBe(7)
  })
})
