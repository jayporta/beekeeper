import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardTokens } from '../CardTokens'
import { PARTIAL_FOOTNOTE_ID } from '../partialFootnoteId'
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
  it('shows the tokens and the API-priced cost', () => {
    renderTokens()

    expect(screen.getByText('12.4M tokens')).toBeTruthy()
    expect(screen.getByText('$3.20 at API prices')).toBeTruthy()
  })

  it('shows zero tokens as a known value', () => {
    renderTokens({ figures: { ...FIGURES, tokens: 0, usd: 0 } })

    expect(screen.getByText('0 tokens')).toBeTruthy()
    expect(screen.getByText('$0.00 at API prices')).toBeTruthy()
  })

  it('labels a team total, and leaves the label off a single session', () => {
    const { unmount } = render(<CardTokens figures={FIGURES} teamTotal partial={false} />)
    expect(screen.getByText('team total')).toBeTruthy()
    unmount()

    renderTokens()
    expect(screen.queryByText('team total')).toBeNull()
  })

  it('marks partial figures with a superscript hidden from assistive tech and a spoken note', () => {
    renderTokens({ partial: true })

    expect(screen.getByText('¹').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('partial, see note')).toBeTruthy()
  })

  it('points the figure at the footnote only when it is partial', () => {
    const { unmount } = render(<CardTokens figures={FIGURES} teamTotal={false} partial />)
    expect(
      screen
        .getByText('12.4M tokens')
        .closest('[aria-describedby]')
        ?.getAttribute('aria-describedby')
    ).toBe(PARTIAL_FOOTNOTE_ID)
    unmount()

    renderTokens()
    expect(document.querySelector('[aria-describedby]')).toBeNull()
  })

  it('shows no marker when the figures are complete', () => {
    renderTokens()

    expect(screen.queryByText('¹')).toBeNull()
    expect(screen.queryByText('partial, see note')).toBeNull()
  })

  it('names the missing tokens for assistive technology while the cost still shows', () => {
    const container = renderTokens({ figures: { ...FIGURES, tokens: null } })

    expect(container.textContent).toContain('-tokens not recorded')
    expect(screen.getByText('$3.20 at API prices')).toBeTruthy()
  })

  it('names the missing cost for assistive technology while the tokens still show', () => {
    const container = renderTokens({ figures: { ...FIGURES, usd: null } })

    expect(screen.getByText('12.4M tokens')).toBeTruthy()
    expect(container.textContent).toContain('-cost not recorded')
  })

  it('shows a single not recorded when there are no figures', () => {
    const container = renderTokens({ figures: null })

    expect(container.textContent).toBe('-not recorded')
  })

  it('shows a single not recorded when both figures are missing', () => {
    const container = renderTokens({ figures: { ...FIGURES, tokens: null, usd: null } })

    expect(container.textContent).toBe('-not recorded')
    expect(container.textContent).not.toContain('at API prices')
  })
})
