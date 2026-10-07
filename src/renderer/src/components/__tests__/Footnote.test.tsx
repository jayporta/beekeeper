import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footnote } from '../Footnote'

describe('Footnote', () => {
  it('renders the label and the sentences as one paragraph', () => {
    render(<Footnote id="note" label="¹ Partial." sentences={['One.', 'Two.']} />)

    expect(screen.getByText('¹ Partial. One. Two.')).toBeTruthy()
  })

  it('puts the id on the paragraph so a figure can describe itself by it', () => {
    render(<Footnote id="note" label="¹ Partial." sentences={['One.']} />)

    expect(screen.getByText('¹ Partial. One.').id).toBe('note')
  })

  it('renders nothing when there are no sentences', () => {
    const { container } = render(<Footnote id="note" label="¹ Partial." sentences={[]} />)

    expect(container.firstChild).toBeNull()
  })
})
