import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LinkButton } from '../LinkButton'

describe('LinkButton', () => {
  it('renders a button named by its children', () => {
    render(<LinkButton onClick={vi.fn()}>Open patch</LinkButton>)

    expect(screen.getByRole('button', { name: 'Open patch' })).toBeDefined()
  })

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<LinkButton onClick={onClick}>Open patch</LinkButton>)

    await userEvent.click(screen.getByRole('button', { name: 'Open patch' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('styles a strong button differently from a quiet one', () => {
    render(
      <>
        <LinkButton onClick={vi.fn()}>Quiet</LinkButton>
        <LinkButton strong onClick={vi.fn()}>
          Strong
        </LinkButton>
      </>
    )

    expect(screen.getByRole('button', { name: 'Strong' }).className).not.toBe(
      screen.getByRole('button', { name: 'Quiet' }).className
    )
  })
})
