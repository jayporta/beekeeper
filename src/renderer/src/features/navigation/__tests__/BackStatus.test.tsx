import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BackStatus } from '../BackStatus'

describe('BackStatus', () => {
  it('is a status region, empty until there is a message', () => {
    render(<BackStatus message="" id={0} />)

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('says the message in the status region', () => {
    render(<BackStatus message="Nothing to go back to" id={1} />)

    expect(screen.getByRole('status').textContent).toBe('Nothing to go back to')
  })

  it('is hidden from view, for screen readers only', () => {
    render(<BackStatus message="Nothing to go back to" id={1} />)

    expect(screen.getByRole('status').classList.contains('visuallyHidden')).toBe(true)
  })

  it('mounts a fresh node for each message id, so an identical message is announced again', () => {
    const { rerender } = render(<BackStatus message="Nothing to go back to" id={1} />)
    const first = screen.getByText('Nothing to go back to')

    rerender(<BackStatus message="Nothing to go back to" id={2} />)

    expect(screen.getByText('Nothing to go back to')).not.toBe(first)
  })

  it('keeps the same node while the id is unchanged', () => {
    const { rerender } = render(<BackStatus message="Nothing to go back to" id={1} />)
    const first = screen.getByText('Nothing to go back to')

    rerender(<BackStatus message="Nothing to go back to" id={1} />)

    expect(screen.getByText('Nothing to go back to')).toBe(first)
  })
})
