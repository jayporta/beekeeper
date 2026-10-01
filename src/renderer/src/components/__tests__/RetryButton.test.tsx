import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RetryButton } from '../RetryButton'

describe('RetryButton', () => {
  it('calls onRetry when clicked', async () => {
    const onRetry = vi.fn()
    render(<RetryButton onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('moves focus to the enclosing main before retrying', async () => {
    let focusedWhenRetried: Element | null = null
    render(
      <main tabIndex={-1}>
        <RetryButton
          onRetry={() => {
            focusedWhenRetried = document.activeElement
          }}
        />
      </main>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(focusedWhenRetried).toBe(screen.getByRole('main'))
  })

  it('still retries when there is no enclosing main', async () => {
    const onRetry = vi.fn()
    render(<RetryButton onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })
})
