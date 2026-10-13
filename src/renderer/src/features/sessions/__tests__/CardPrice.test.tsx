import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardPrice } from '../CardPrice'
import type { UsageFigures } from '../sessionUsage'

const FIGURES: UsageFigures = {
  tokens: 12_400_000,
  usd: 3.2,
  tokensPartial: false,
  usdPartial: false
}

const textOf = (figures: UsageFigures | null): string =>
  render(<CardPrice figures={figures} />).container.textContent ?? ''

describe('CardPrice', () => {
  it('shows the cost at API prices, named for assistive technology', () => {
    expect(textOf(FIGURES)).toBe('API price $3.20')
  })

  it('shows zero cost as a known value', () => {
    expect(textOf({ ...FIGURES, usd: 0 })).toBe('API price $0.00')
  })

  it('names the missing cost for assistive technology while the tokens still show', () => {
    expect(textOf({ ...FIGURES, usd: null })).toBe('API price -cost not recorded')
  })

  it('shows only a dash that assistive technology skips when there are no figures', () => {
    const { container } = render(<CardPrice figures={null} />)

    expect(container.textContent).toBe('-')
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('-')
  })

  it('shows only that dash when both figures are missing', () => {
    expect(textOf({ ...FIGURES, tokens: null, usd: null })).toBe('-')
  })
})
