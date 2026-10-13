import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShareBar } from '../ShareBar'

/** The fill element: the track's only child. */
function fillOf(container: HTMLElement): HTMLElement {
  const fill = container.querySelector('[aria-hidden="true"] > div')
  if (!(fill instanceof HTMLElement)) throw new Error('no fill')
  return fill
}

describe('ShareBar', () => {
  it('fills the share of the track', () => {
    const { container } = render(<ShareBar share={0.25} />)

    expect(fillOf(container).style.inlineSize).toBe('25%')
  })

  it('draws an empty fill for a share of 0', () => {
    const { container } = render(<ShareBar share={0} />)

    expect(fillOf(container).style.inlineSize).toBe('0%')
  })

  it('keeps a share past 1 inside the track', () => {
    const { container } = render(<ShareBar share={1.5} />)

    expect(fillOf(container).style.inlineSize).toBe('100%')
  })

  it('draws an empty fill for a share that is not a number', () => {
    const { container } = render(<ShareBar share={Number.NaN} />)

    expect(fillOf(container).style.inlineSize).toBe('0%')
  })

  it('hides the bar from assistive technology', () => {
    const { container } = render(<ShareBar share={0.5} />)

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('styles the thin size differently from the regular one', () => {
    const { container } = render(
      <>
        <ShareBar share={0.5} />
        <ShareBar share={0.5} size="thin" />
      </>
    )

    const [regular, thin] = Array.from(container.children)
    expect(thin?.className).not.toBe(regular?.className)
  })
})
