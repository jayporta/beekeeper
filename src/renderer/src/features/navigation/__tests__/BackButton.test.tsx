import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackButton } from '../BackButton'

describe('BackButton', () => {
  it('is a button named Back', () => {
    render(<BackButton canGoBack onBack={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
  })

  it('goes back when pressed', async () => {
    const onBack = vi.fn()
    render(<BackButton canGoBack onBack={onBack} />)

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('goes back from the keyboard', async () => {
    const onBack = vi.fn()
    render(<BackButton canGoBack onBack={onBack} />)

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('is not marked disabled while there is somewhere to go back to', () => {
    render(<BackButton canGoBack onBack={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Back' }).getAttribute('aria-disabled')).not.toBe(
      'true'
    )
  })

  it('says it is unavailable to assistive technology when there is nowhere to go back to', () => {
    render(<BackButton canGoBack={false} onBack={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Back' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('stays in the tab order and keeps its name when unavailable, so a person on it keeps their place', async () => {
    render(<BackButton canGoBack={false} onBack={vi.fn()} />)

    await userEvent.tab()

    const button = screen.getByRole('button', { name: 'Back' })
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(button)
  })

  it('ignores presses when unavailable', async () => {
    const onBack = vi.fn()
    render(<BackButton canGoBack={false} onBack={onBack} />)

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.keyboard('{Enter}')

    expect(onBack).not.toHaveBeenCalled()
  })

  it('hides its icon from assistive technology, since the text names the button', () => {
    render(<BackButton canGoBack onBack={vi.fn()} />)

    const icon = screen.getByRole('button', { name: 'Back' }).querySelector('svg')

    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })
})
