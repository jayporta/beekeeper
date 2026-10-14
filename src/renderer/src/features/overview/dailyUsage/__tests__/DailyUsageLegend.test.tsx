import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DailyUsageLegend } from '../DailyUsageLegend'
import { seriesOf } from '../seriesOf'
import { testSummary } from '../testDailyUsage'

function legendFor(models: Record<string, number>): React.JSX.Element {
  return <DailyUsageLegend series={seriesOf(testSummary({ '2026-03-10': models }).days)} />
}

describe('DailyUsageLegend', () => {
  it('lists each family in the fixed order, however large it is', () => {
    render(
      legendFor({
        'claude-haiku-5': 9,
        'claude-opus-5': 1,
        'claude-sonnet-5': 5,
        'claude-fable-1': 2
      })
    )

    const items = within(screen.getByRole('list', { name: 'Models' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Fable', 'Opus', 'Sonnet', 'Haiku'])
  })

  it('names a model that fits no family "Other models"', () => {
    render(legendFor({ 'claude-opus-5': 1, mystery: 2 }))

    const items = within(screen.getByRole('list', { name: 'Models' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Opus', 'Other models'])
  })

  it('never shows a model id, which is transcript text', () => {
    const { container } = render(legendFor({ '<b>bold</b>': 5 }))

    expect(screen.queryByText('<b>bold</b>')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('hides the color swatches from assistive technology', () => {
    render(legendFor({ a: 1 }))

    const item = within(screen.getByRole('list', { name: 'Models' })).getByRole('listitem')
    expect(item.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders nothing for no series', () => {
    const { container } = render(<DailyUsageLegend series={[]} />)

    expect(container.firstChild).toBeNull()
  })
})
