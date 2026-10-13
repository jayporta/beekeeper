import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardTokens } from '../CardTokens'
import type { UsageFigures } from '../sessionUsage'

const FIGURES: UsageFigures = {
  tokens: 12_400_000,
  usd: 3.2,
  tokensPartial: false,
  usdPartial: false
}

interface RenderOptions {
  readonly figures?: UsageFigures | null
  readonly teamTotal?: boolean
  readonly partial?: boolean
}

function renderTokens({
  figures = FIGURES,
  teamTotal = false,
  partial = false
}: RenderOptions = {}): HTMLElement {
  const { container } = render(
    <CardTokens figures={figures} teamTotal={teamTotal} partial={partial} />
  )
  return container
}

describe('CardTokens', () => {
  it('shows the token count with a tokens label beneath', () => {
    renderTokens()

    expect(screen.getByText(/^12\.4M/)).toBeTruthy()
    expect(screen.getByText('tokens')).toBeTruthy()
  })

  it('shows zero tokens as a known value', () => {
    renderTokens({ figures: { ...FIGURES, tokens: 0, usd: 0 } })

    expect(screen.getByText('0')).toBeTruthy()
  })

  it('labels a team total, and leaves the label off a single session', () => {
    const { unmount } = render(<CardTokens figures={FIGURES} teamTotal partial={false} />)
    expect(screen.getByText('team total')).toBeTruthy()
    unmount()

    renderTokens()
    expect(screen.queryByText('team total')).toBeNull()
  })

  it('still says tokens to assistive technology for a team total', () => {
    const container = renderTokens({ teamTotal: true })

    expect(container.textContent).toContain('team total tokens')
  })

  it('marks partial figures with a superscript hidden from assistive tech and a spoken note', () => {
    renderTokens({ partial: true })

    expect(screen.getByText('¹').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('partial, see the note below the list')).toBeTruthy()
  })

  it('does not describe the figure by the footnote, which a plain paragraph is not reliably read with', () => {
    const container = renderTokens({ partial: true })

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('¹')
    expect(container.querySelector('[aria-describedby]')).toBeNull()
  })

  it('shows no marker when the figures are complete', () => {
    renderTokens()

    expect(screen.queryByText('¹')).toBeNull()
    expect(screen.queryByText('partial, see the note below the list')).toBeNull()
  })

  it('names the missing tokens for assistive technology', () => {
    const container = renderTokens({ figures: { ...FIGURES, tokens: null } })

    expect(container.textContent).toBe('-tokens not recorded')
  })

  it('keeps the partial marker when the tokens are missing but the cost is known', () => {
    renderTokens({ figures: { ...FIGURES, tokens: null }, partial: true })

    expect(screen.getByText('¹')).toBeTruthy()
    expect(screen.getByText('partial, see the note below the list')).toBeTruthy()
  })

  it('shows a single tokens and cost not recorded when there are no figures', () => {
    const container = renderTokens({ figures: null })

    expect(container.textContent).toBe('-tokens and cost not recorded')
  })

  it('shows a single tokens and cost not recorded when both figures are missing', () => {
    const container = renderTokens({ figures: { ...FIGURES, tokens: null, usd: null } })

    expect(container.textContent).toBe('-tokens and cost not recorded')
  })
})
