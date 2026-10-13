import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { byModelTotals } from '../byModelTotals'
import { ModelBreakdown } from '../ModelBreakdown'
import type { Series } from '../seriesOf'

function rowsFor(entries: [Series['key'], number][], total: number): React.JSX.Element {
  const series = entries.map(([key, tokens]) => ({ key, total: tokens }))
  return <ModelBreakdown rows={byModelTotals(series, total)} />
}

function texts(): string[] {
  return within(screen.getByRole('list', { name: 'Tokens by model' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

describe('ModelBreakdown', () => {
  it('has a row per family with its name, compact tokens and percent', () => {
    render(
      rowsFor(
        [
          ['opus', 1_500_000],
          ['other', 500_000]
        ],
        2_000_000
      )
    )

    expect(texts()).toEqual(['Opus1.5M75%', 'Other models500K25%'])
  })

  it('says "<1%" for a family with tokens but under one percent', () => {
    render(
      rowsFor(
        [
          ['opus', 9_990],
          ['haiku', 10]
        ],
        10_000
      )
    )

    expect(texts()[1]).toBe('Haiku10<1%')
  })

  it('says 0% for a family with no tokens in a zero total', () => {
    render(rowsFor([['opus', 0]], 0))

    expect(texts()).toEqual(['Opus00%'])
  })

  it('hides the swatches from assistive technology', () => {
    render(rowsFor([['opus', 1]], 1))

    expect(
      within(screen.getByRole('listitem'))
        .getByText('Opus')
        .parentElement?.querySelector('[aria-hidden="true"]')
    ).not.toBeNull()
  })
})
