import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
