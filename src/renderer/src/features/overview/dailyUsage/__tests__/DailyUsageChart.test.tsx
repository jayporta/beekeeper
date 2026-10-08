import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DailyUsageChart } from '../DailyUsageChart'
import { seriesOf } from '../seriesOf'
import { OCTOBER_WEEK, dayKeys, testSummary } from '../testDailyUsage'

function chartFor(
  days: Parameters<typeof testSummary>[0],
  range: '7d' | '30d' = '7d'
): React.JSX.Element {
  const { days: summed } = testSummary(days)
  return <DailyUsageChart days={summed} series={seriesOf(summed)} range={range} />
}

describe('DailyUsageChart', () => {
  it('is an image named for its range, total, and busiest day', () => {
    render(chartFor(OCTOBER_WEEK))

    expect(
      screen.getByRole('img', {
        name: 'Tokens per day, last 7 days: 41.2M in all, most on Wed, Oct 7 with 9.8M'
      })
    ).toBeTruthy()
  })

  it('says there were no tokens when the window is empty', () => {
    render(chartFor(Object.fromEntries(dayKeys(7, '2026-10-07').map((day) => [day, {}]))))

    expect(screen.getByRole('img', { name: 'No tokens in the last 7 days' })).toBeTruthy()
  })

  it('names the 30 day range', () => {
    const days = Object.fromEntries(dayKeys(30, '2026-10-07').map((day) => [day, { a: 1000 }]))

    render(chartFor(days, '30d'))

    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('last 30 days')
  })

  it('has nothing focusable inside', () => {
    const { container } = render(chartFor(OCTOBER_WEEK))

    expect(
      container.querySelectorAll('a, button, input, select, textarea, [tabindex]')
    ).toHaveLength(0)
  })

  it('labels the axis with compact ticks up to the rounded top', () => {
    render(chartFor(OCTOBER_WEEK))

    for (const tick of ['0', '2M', '4M', '6M', '8M', '10M']) {
      expect(screen.getAllByText(tick).length).toBeGreaterThan(0)
    }
  })

  it('labels every day of a week with its weekday and date', () => {
    render(chartFor(OCTOBER_WEEK))

    for (const label of ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('Oct 1')).toBeTruthy()
    expect(screen.getByText('Oct 7')).toBeTruthy()
  })

  it('labels every fifth day of a month, counting back from the last', () => {
    const days = Object.fromEntries(dayKeys(30, '2026-10-07').map((day) => [day, { a: 1000 }]))

    render(chartFor(days, '30d'))

    const labels = screen.getAllByText(/^[A-Z][a-z]{2} \d{1,2}$/).map((e) => e.textContent)
    expect(labels).toEqual(['Sep 12', 'Sep 17', 'Sep 22', 'Sep 27', 'Oct 2', 'Oct 7'])
  })

  it('draws a segment for each model with tokens on a day, and none for a model without', () => {
    render(chartFor(OCTOBER_WEEK))

    expect(screen.getAllByTitle(/^Thu, Oct 1: /)).toHaveLength(2)
    expect(screen.getAllByTitle(/^Fri, Oct 2: /)).toHaveLength(1)
  })

  it('titles a segment with its day, model, and exact tokens', () => {
    render(chartFor(OCTOBER_WEEK))

    expect(screen.getByTitle('Wed, Oct 7: claude-haiku-5, 3,800,000 tokens')).toBeTruthy()
  })

  it('sizes a day’s bar by its share of the axis top, and its segments by their tokens', () => {
    render(chartFor({ '2026-10-06': { a: 10, b: 30 }, '2026-10-07': { a: 25 } }))

    // The axis tops out at 40: the first day fills it, the second takes 25 of 40.
    const first = screen.getByTitle('Tue, Oct 6: a, 10 tokens').parentElement
    const second = screen.getByTitle('Wed, Oct 7: a, 25 tokens').parentElement
    expect(first?.style.blockSize).toBe('100%')
    expect(second?.style.blockSize).toBe('62.5%')
    expect(screen.getByTitle('Tue, Oct 6: a, 10 tokens').style.flexGrow).toBe('10')
    expect(screen.getByTitle('Tue, Oct 6: b, 30 tokens').style.flexGrow).toBe('30')
  })
})
