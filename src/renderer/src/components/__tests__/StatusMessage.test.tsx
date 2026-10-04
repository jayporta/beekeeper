import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MAIN_HEADING_ID } from '../mainHeading'
import { StatusMessage } from '../StatusMessage'

describe('StatusMessage', () => {
  it('renders the heading as an h1 and the body', () => {
    render(<StatusMessage heading="Nothing here" body="Try later." />)

    expect(screen.getByRole('heading', { level: 1, name: 'Nothing here' })).toBeTruthy()
    expect(screen.getByText('Try later.')).toBeTruthy()
  })

  it('renders its children as the action', () => {
    render(
      <StatusMessage heading="Oops">
        <button type="button">Retry</button>
      </StatusMessage>
    )

    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('exposes a live region when given a role', () => {
    render(<StatusMessage heading="Loading" role="status" />)

    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('gives a level 2 heading and the body the ids it is given', () => {
    render(<StatusMessage heading="Gone" headingLevel={2} headingId="h" body="Why." bodyId="b" />)

    expect(screen.getByRole('heading', { name: 'Gone' }).id).toBe('h')
    expect(screen.getByText('Why.').id).toBe('b')
  })

  it('keeps a level 1 heading on the main heading id, whatever heading id is given', () => {
    render(<StatusMessage heading="Gone" headingId="h" />)

    expect(screen.getByRole('heading', { name: 'Gone' }).id).toBe(MAIN_HEADING_ID)
  })
})
