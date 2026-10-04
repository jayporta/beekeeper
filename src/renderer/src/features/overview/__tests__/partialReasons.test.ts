import { describe, expect, it } from 'vitest'
import type { FolderTotalsState } from '../folderTotalsState'
import { partialReasonsOf } from '../partialReasons'
import { sumTotals } from '../sumTotals'
import { readyTotals, testTotals } from '../testTotals'

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
