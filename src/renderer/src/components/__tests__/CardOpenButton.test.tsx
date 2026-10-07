import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CardOpenButton } from '../CardOpenButton'

describe('CardOpenButton', () => {
  it('renders a button named by its children', () => {
    render(<CardOpenButton onClick={vi.fn()}>my-project</CardOpenButton>)

    expect(screen.getByRole('button', { name: 'my-project' })).toBeDefined()
  })

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<CardOpenButton onClick={onClick}>my-project</CardOpenButton>)

    await userEvent.click(screen.getByRole('button', { name: 'my-project' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is described by the elements it points at', () => {
    render(
      <>
        <CardOpenButton describedBy="note" onClick={vi.fn()}>
          my-project
        </CardOpenButton>
        <p id="note">12 sessions</p>
      </>
    )

    expect(
      screen.getByRole('button', { name: 'my-project', description: '12 sessions' })
    ).toBeDefined()
  })

  it('carries the attribute that cards style their focus ring by', () => {
    render(<CardOpenButton onClick={vi.fn()}>my-project</CardOpenButton>)

    expect(screen.getByRole('button', { name: 'my-project' }).hasAttribute('data-card-open')).toBe(
      true
    )
  })

  it("adds the caller's class to its own", () => {
    render(
      <CardOpenButton className="extra" onClick={vi.fn()}>
        my-project
      </CardOpenButton>
    )

    expect(screen.getByRole('button', { name: 'my-project' }).classList.contains('extra')).toBe(
      true
    )
  })
})
