import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartialMarker } from '../PartialMarker'

describe('PartialMarker', () => {
  it('speaks the note it is given', () => {
    render(<PartialMarker note="partial, see below" />)

    expect(screen.getByText('partial, see below')).toBeTruthy()
  })

  it('shows a superscript marker that assistive technology skips', () => {
    const { container } = render(<PartialMarker note="partial, see below" />)

    const marker = container.querySelector('sup')
    expect(marker?.textContent).toBe('¹')
    expect(marker?.getAttribute('aria-hidden')).toBe('true')
  })
})
