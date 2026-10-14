import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FolderTotalsState } from '../../../../../shared/overview/folderTotalsState'
import { KpiTiles } from '../KpiTiles'
import { sumTotals } from '../../../../../shared/overview/sumTotals'
import { readyTotals, testTotals } from '../../../../../shared/overview/testTotals'

const FIGURES = { tokens: 2_000_000, usd: 16.5, sessions: 6, agents: 11 }

function tiles(
  states: readonly FolderTotalsState[],
  range: '7d' | '30d' = '7d'
): React.JSX.Element {
  return <KpiTiles totals={sumTotals(states)} range={range} />
}

function tile(name: string): HTMLElement {
  const item = screen
    .getAllByRole('listitem')
    .find((li) => li.firstElementChild?.textContent === name)
  if (item === undefined) throw new Error(`No ${name} tile`)
  return item
}

describe('KpiTiles', () => {
  it('shows four tiles in a list named for the window, each with a label, a value and a sub-label', () => {
    render(tiles([readyTotals(FIGURES)]))

    const list = screen.getByRole('list', { name: 'Totals, last 7 days' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      'Tokens2Mlast 7 days',
      'At API prices$16.50an estimate, not your bill',
      'Sessions6leads and solo sessions',
      'Agents11incl. teammates and subagents'
    ])
  })

  it('names the 30 day window in the tokens sub-label', () => {
    render(tiles([readyTotals(FIGURES)], '30d'))

    expect(within(tile('Tokens')).getByText('last 30 days')).toBeTruthy()
  })

  it('shows zero rather than a placeholder for a ready sum with nothing in it', () => {
    render(tiles([readyTotals()]))

    expect(within(tile('Sessions')).getByText('0')).toBeTruthy()
    expect(within(tile('At API prices')).getByText('$0.00')).toBeTruthy()
  })

  it('shows a loading placeholder in every tile while no folder has totals', () => {
    render(tiles([{ status: 'loading' }]))

    for (const name of ['Tokens', 'At API prices', 'Sessions', 'Agents']) {
      expect(within(tile(name)).getByText('Loading')).toBeTruthy()
    }
  })

  it('shows an unavailable placeholder in every tile when every folder failed', () => {
    render(tiles([{ status: 'error', code: 'unreadable' }]))

    for (const name of ['Tokens', 'At API prices', 'Sessions', 'Agents']) {
      expect(within(tile(name)).getByText('Unavailable')).toBeTruthy()
    }
  })

  it('marks only the cost when only the cost may be low', () => {
    render(
      tiles([readyTotals({ ...FIGURES, partial: { ...testTotals().partial, withoutCost: 1 } })])
    )

    expect(tile('At API prices').textContent).toContain('¹')
    expect(tile('Tokens').textContent).not.toContain('¹')
    expect(tile('Sessions').textContent).not.toContain('¹')
    expect(tile('Agents').textContent).not.toContain('¹')
  })

  it('names the list as updating, with a note, while the figures are the other window’s', () => {
    render(tiles([readyTotals(FIGURES, true)]))

    expect(screen.getByRole('list', { name: 'Totals, last 7 days, updating' })).toBeTruthy()
    expect(screen.getByText('Updating')).toBeTruthy()
  })

  it('has no updating note once the figures are this window’s', () => {
    render(tiles([readyTotals(FIGURES)]))

    expect(screen.queryByText('Updating')).toBeNull()
  })
})
