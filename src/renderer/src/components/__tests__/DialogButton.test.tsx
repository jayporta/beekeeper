import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DialogButton } from '../DialogButton'

describe('DialogButton', () => {
  it('renders a button named by its children', () => {
    render(<DialogButton onClick={vi.fn()}>Copy</DialogButton>)

    expect(screen.getByRole('button', { name: 'Copy' })).toBeDefined()
  })

  it('is not a submit button, so it never submits a form around it', () => {
    render(<DialogButton onClick={vi.fn()}>Copy</DialogButton>)

    expect(screen.getByRole('button', { name: 'Copy' }).getAttribute('type')).toBe('button')
  })

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<DialogButton onClick={onClick}>Copy</DialogButton>)

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
