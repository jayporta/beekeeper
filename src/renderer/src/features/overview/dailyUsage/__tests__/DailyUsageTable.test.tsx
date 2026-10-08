import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DailyUsageTable } from '../DailyUsageTable'
import { seriesOf } from '../seriesOf'
import { OCTOBER_WEEK, testSummary } from '../testDailyUsage'

function tableFor(days: Parameters<typeof testSummary>[0]): React.JSX.Element {
  const { days: summed, total } = testSummary(days)
  return <DailyUsageTable days={summed} total={total} series={seriesOf(summed)} range="7d" />
}

describe('DailyUsageTable', () => {
  it('has a caption naming its range', () => {
    render(tableFor(OCTOBER_WEEK))

    expect(
      screen.getByRole('table', { name: 'Tokens per day, by model, last 7 days' })
    ).toBeTruthy()
  })

  it('has a column for the day, each model, and the total', () => {
    render(tableFor(OCTOBER_WEEK))

    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual([
      'Day',
      'claude-opus-5',
      'claude-haiku-5',
      'Total'
    ])
    for (const header of headers) expect(header.getAttribute('scope')).toBe('col')
  })

  it('has a row for each day, headed by its weekday and date, then a total row', () => {
    render(tableFor(OCTOBER_WEEK))

    const rowHeaders = screen.getAllByRole('rowheader')
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      'Thu, Oct 1',
      'Fri, Oct 2',
      'Sat, Oct 3',
      'Sun, Oct 4',
      'Mon, Oct 5',
      'Tue, Oct 6',
      'Wed, Oct 7',
      'Total'
    ])
    for (const header of rowHeaders) expect(header.getAttribute('scope')).toBe('row')
  })

  it('shows exact numbers, with zero for a model that did not run that day', () => {
    render(tableFor(OCTOBER_WEEK))

    const row = screen.getByRole('row', { name: /Fri, Oct 2/ })
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['7,000,000', '0', '7,000,000'])
  })

  it('ends with each model’s total and the total of all', () => {
    render(tableFor(OCTOBER_WEEK))

    const footer = screen.getByRole('row', { name: /^Total/ })
    expect(
      within(footer)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['33,200,000', '8,000,000', '41,200,000'])
  })

  it('ends with the total it is given rather than adding the days again', () => {
    const { days } = testSummary(OCTOBER_WEEK)

    render(<DailyUsageTable days={days} total={123} series={seriesOf(days)} range="7d" />)

    const footer = screen.getByRole('row', { name: /^Total/ })
    expect(within(footer).getAllByRole('cell').at(-1)?.textContent).toBe('123')
  })

  it('shows a very long model id as text in its header', () => {
    const id = `claude-${'y'.repeat(100)}`
    render(tableFor({ '2026-10-07': { [id]: 1 } }))

    expect(screen.getByRole('columnheader', { name: id })).toBeTruthy()
  })
})
