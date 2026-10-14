import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { groupSessionRows } from '../../../../../shared/sessions/groupSessionRows'
import { SessionCardList } from '../SessionCardList'
import { testSession } from '../../../../../shared/sessions/testSessionFixtures'
import { testLabelWords } from '../testLabelWords'

const big = testSession(1, { title: 'Big', latestMs: 2, totalTokens: 1000, costUSD: 4 })
const small = testSession(2, { title: 'Small', latestMs: 1, totalTokens: 250, archived: true })

function renderList(
  items = [big, small],
  props: { matchCount?: number | null; largestTokens?: number } = {}
): HTMLElement {
  const { container } = render(
    <SessionCardList
      rows={groupSessionRows(items, testLabelWords)}
      labelledBy="h"
      selectedDirName="-p"
      largestTokens={props.largestTokens ?? 1000}
      matchCount={props.matchCount ?? null}
      query=""
    />
  )
  return container
}

/** The row of the session with this title. */
const rowOf = (title: string): HTMLElement =>
  screen.getByRole('heading', { level: 3, name: title }).closest('li') as HTMLElement

/** The width the row's share bar fills. */
const barOf = (title: string): string | undefined =>
  rowOf(title).querySelector<HTMLElement>('[aria-hidden="true"] > div')?.style.inlineSize

describe('SessionCardList as the Sessions card', () => {
  it('is a region titled Sessions that holds the list', () => {
    renderList()

    const region = screen.getByRole('region', { name: 'Sessions' })
    expect(within(region).getByRole('heading', { level: 2, name: 'Sessions' })).toBeTruthy()
    expect(within(region).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('shows no match count when no search is active', () => {
    renderList()

    expect(screen.queryByText(/\bmatch/)).toBeNull()
  })

  it('shows the match count, hidden from assistive technology, beside the title while searching', () => {
    renderList([big], { matchCount: 1 })

    expect(screen.getByText('1 match').getAttribute('aria-hidden')).toBe('true')
  })

  it('draws each bar against the largest row of the whole list, not only the rows shown', () => {
    renderList([small], { largestTokens: 1000 })

    expect(barOf('Small')).toBe('25%')
  })

  it('draws a full bar for the largest row', () => {
    renderList()

    expect(barOf('Big')).toBe('100%')
  })

  it('draws an empty bar, not NaN, when no row has tokens', () => {
    renderList([testSession(3, { title: 'None' })], { largestTokens: 0 })

    expect(barOf('None')).toBe('0%')
  })

  it('shows the tokens and the API price in their own cells', () => {
    renderList()

    const row = within(rowOf('Big'))
    expect(row.getByText('1K')).toBeTruthy()
    expect(row.getByText('$4.00')).toBeTruthy()
  })

  it('hides the column header row from assistive technology', () => {
    renderList()

    const headers = screen.getAllByText('API price')
    expect(headers.some((header) => header.closest('[aria-hidden="true"]') !== null)).toBe(true)
  })
})
