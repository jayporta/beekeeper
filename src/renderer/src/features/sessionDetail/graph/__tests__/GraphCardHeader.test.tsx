import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraphCardHeader } from '../GraphCardHeader'

describe('GraphCardHeader', () => {
  it('titles the card with a level 2 heading', () => {
    render(<GraphCardHeader controls={null} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Agent graph' })).toBeTruthy()
  })

  it('shows the legend for the node marks whatever the graph holds', () => {
    render(<GraphCardHeader controls={null} />)

    for (const text of ['× tool errors', '▲ compactions', '■ stopped']) {
      expect(screen.getByText(text)).toBeTruthy()
    }
  })

  it('hides the legend from assistive technology, since a node’s name says its marks', () => {
    render(<GraphCardHeader controls={null} />)

    expect(screen.getByText('× tool errors').parentElement?.getAttribute('aria-hidden')).toBe(
      'true'
    )
  })

  it('shows the controls it is given', () => {
    render(<GraphCardHeader controls={<button type="button">Zoom</button>} />)

    expect(screen.getByRole('button', { name: 'Zoom' })).toBeTruthy()
  })
})
