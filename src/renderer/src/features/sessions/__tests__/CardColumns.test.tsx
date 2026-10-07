import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardColumns } from '../CardColumns'

describe('CardColumns', () => {
  it('renders its children', () => {
    render(
      <CardColumns>
        <span>title</span>
        <span>tokens</span>
      </CardColumns>
    )

    expect(screen.getByText('title')).toBeTruthy()
    expect(screen.getByText('tokens')).toBeTruthy()
  })

  it('adds the class a caller passes to the row', () => {
    render(<CardColumns className="extra">cells</CardColumns>)

    expect(screen.getByText('cells').classList.contains('extra')).toBe(true)
  })

  it('hides the row from assistive technology when it is decorative', () => {
    render(<CardColumns decorative>cells</CardColumns>)

    expect(screen.getByText('cells').getAttribute('aria-hidden')).toBe('true')
  })
})
