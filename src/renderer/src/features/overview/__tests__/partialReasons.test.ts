import { describe, expect, it } from 'vitest'
import type { FolderTotalsState } from '../folderTotalsState'
import { isPartialFor, partialReasonsOf, type PartialFigure } from '../partialReasons'
import { sumTotals } from '../sumTotals'
import { readyTotals, testTotals } from '../testTotals'

const loading: FolderTotalsState = { status: 'loading' }
const failed: FolderTotalsState = { status: 'error', code: 'unreadable' }
const ALL = ['tokens', 'cost', 'sessions', 'agents'] as const

const partialOf = (
  overrides: Partial<ReturnType<typeof testTotals>['partial']>
): FolderTotalsState => readyTotals({ partial: { ...testTotals().partial, ...overrides } })

describe('partialReasonsOf', () => {
  it('is empty for a complete sum', () => {
    expect(partialReasonsOf(sumTotals([readyTotals({ tokens: 5 })]))).toEqual([])
  })

  it.each([
    ['withoutTokens', 'withoutTokens'],
    ['withoutCost', 'withoutCost'],
    ['unreadable', 'unreadable'],
    ['lowTokens', 'lowTokens'],
    ['uncountedSubagents', 'uncountedSubagents'],
    ['undated', 'undated']
  ] as const)('names %s when a session has it', (field, reason) => {
    expect(partialReasonsOf(sumTotals([partialOf({ [field]: 1 })]))).toEqual([reason])
  })

  it('names a folder still loading and a folder that failed', () => {
    const totals = sumTotals([{ status: 'loading' }, { status: 'error', code: 'unreadable' }])

    expect(partialReasonsOf(totals)).toEqual(['loading', 'failed'])
  })

  it('gives the reasons in footnote order, whatever order they were found in', () => {
    const totals = sumTotals([
      partialOf({ undated: 1 }),
      { status: 'loading' },
      partialOf({ withoutTokens: 1 })
    ])

    expect(partialReasonsOf(totals)).toEqual(['loading', 'withoutTokens', 'undated'])
  })
})

/** Which of the figures a sum marks as partial, in the order tokens, cost, sessions, agents. */
function markedFigures(states: readonly FolderTotalsState[]): readonly PartialFigure[] {
  const totals = sumTotals(states)
  return (['tokens', 'cost', 'sessions', 'agents'] as const).filter((figure) =>
    isPartialFor(totals, figure)
  )
}

describe('isPartialFor', () => {
  it('marks no figure of complete totals, zero or not', () => {
    expect(markedFigures([readyTotals({ tokens: 5 }), readyTotals()])).toEqual([])
  })

  it.each([
    ['a folder loading', [readyTotals(), loading], ALL],
    ['a folder that failed', [readyTotals(), failed], ALL],
    ['an unreadable session', [partialOf({ unreadable: 1 })], ALL],
    ['an undated session', [partialOf({ undated: 1 })], ALL],
    ['a session with no tokens', [partialOf({ withoutTokens: 1 })], ['tokens']],
    ['tokens that may be low', [partialOf({ lowTokens: 1 })], ['tokens']],
    ['a session with no cost', [partialOf({ withoutCost: 1 })], ['cost']],
    [
      'a session whose subagents folder could not be read',
      [partialOf({ uncountedSubagents: 1 })],
      ['tokens', 'agents']
    ]
  ] as const)('marks %s on the figures it affects', (_label, states, figures) => {
    expect(markedFigures(states)).toEqual(figures)
  })

  it('marks each figure for the reasons that touch it when sessions differ', () => {
    const states = [partialOf({ withoutCost: 1 }), partialOf({ withoutTokens: 1 })]

    expect(markedFigures(states)).toEqual(['tokens', 'cost'])
  })
})
