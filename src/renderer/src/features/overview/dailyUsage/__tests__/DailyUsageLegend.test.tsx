import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DailyUsageLegend } from '../DailyUsageLegend'
import { seriesOf } from '../seriesOf'
import { testSummary } from '../testDailyUsage'

const LONG_ID = `claude-${'x'.repeat(120)}`

function legendFor(models: Record<string, number>): React.JSX.Element {
  return <DailyUsageLegend series={seriesOf(testSummary({ '2026-03-10': models }).days)} />
}

describe('DailyUsageLegend', () => {
  it('lists each model, largest first', () => {
    render(legendFor({ 'claude-haiku-5': 1, 'claude-opus-5': 9 }))

    const items = within(screen.getByRole('list', { name: 'Models' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['claude-opus-5', 'claude-haiku-5'])
  })

  it('names the rest "Other models" when more than four models ran', () => {
    render(legendFor({ a: 60, b: 50, c: 40, d: 30, e: 20 }))

    const items = within(screen.getByRole('list', { name: 'Models' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['a', 'b', 'c', 'd', 'Other models'])
  })

  it('shows a very long model id as plain text', () => {
    render(legendFor({ [LONG_ID]: 5 }))

    expect(screen.getByText(LONG_ID)).toBeTruthy()
  })

  it('renders model ids that look like markup as text, not elements', () => {
    const { container } = render(legendFor({ '<b>bold</b>': 5 }))

    expect(screen.getByText('<b>bold</b>')).toBeTruthy()
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
