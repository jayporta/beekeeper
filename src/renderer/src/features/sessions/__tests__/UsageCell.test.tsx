import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UsageFigures } from '../sessionUsage'
import { UsageCell } from '../UsageCell'

const FIGURES: UsageFigures = {
  tokens: 12_400_000,
  usd: 3.2,
  tokensPartial: false,
  usdPartial: false
}

function renderCell(
  figures: UsageFigures | null,
  emptyReason?: 'not-recorded' | 'not-applicable'
): HTMLElement {
  render(
    <table>
      <tbody>
        <tr>
          <UsageCell figures={figures} {...(emptyReason !== undefined && { emptyReason })} />
        </tr>
      </tbody>
    </table>
  )
  return screen.getByRole('cell')
}

describe('UsageCell', () => {
  it('shows the tokens and the API-priced cost', () => {
    const cell = renderCell(FIGURES)

    expect(cell.textContent).toContain('12.4M tokens')
    expect(cell.textContent).toContain('$3.20 at API prices')
  })

  it('separates the two lines with a space so they never read run together', () => {
    expect(renderCell(FIGURES).textContent).toBe('12.4M tokens $3.20 at API prices')
  })

  it('shows zero tokens as a known value', () => {
    const cell = renderCell({ ...FIGURES, tokens: 0, usd: 0 })

    expect(cell.textContent).toBe('0 tokens $0.00 at API prices')
  })

  it('puts the partial note after the cost line when only the cost is partial', () => {
    const cell = renderCell({ ...FIGURES, usdPartial: true })

    expect(cell.textContent).toBe('12.4M tokens $3.20 at API prices partial')
  })

  it('puts the partial note after the tokens line when only the tokens are partial', () => {
    const cell = renderCell({ ...FIGURES, tokensPartial: true })

    expect(cell.textContent).toBe('12.4M tokens partial $3.20 at API prices')
  })

  it('names the missing tokens for assistive technology while the cost still shows', () => {
    const cell = renderCell({ ...FIGURES, tokens: null })

    expect(cell.textContent).toBe('-tokens not recorded $3.20 at API prices')
  })

  it('names the missing cost for assistive technology while the tokens still show', () => {
    const cell = renderCell({ ...FIGURES, usd: null })

    expect(cell.textContent).toBe('12.4M tokens -cost not recorded')
  })

  it('shows a single not recorded when both figures are missing', () => {
    const cell = renderCell({ ...FIGURES, tokens: null, usd: null })

    expect(cell.textContent).toBe('-not recorded')
    expect(cell.textContent).not.toContain('at API prices')
  })

  it('reads not applicable when there are no figures and the row has no team', () => {
    expect(renderCell(null, 'not-applicable').textContent).toBe('-not applicable')
  })

  it('reads not recorded when there are no figures by default', () => {
    expect(renderCell(null).textContent).toBe('-not recorded')
  })
})
