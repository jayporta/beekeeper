import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DialogHeader } from '../DialogHeader'

function renderHeader(onClose = vi.fn()): ReturnType<typeof vi.fn> {
  render(
    <DialogHeader headingId="dialog-heading" heading="Details" closeLabel="Close" onClose={onClose}>
      <p>Extra line</p>
    </DialogHeader>
  )
  return onClose
}

describe('DialogHeader', () => {
  it('renders the heading as a level 2 heading with the given id', () => {
    renderHeader()

    expect(screen.getByRole('heading', { level: 2, name: 'Details' }).id).toBe('dialog-heading')
  })

  it('renders the children beneath the heading', () => {
    renderHeader()

    expect(screen.getByText('Extra line')).toBeTruthy()
  })

  it('calls onClose when the close button is pressed', async () => {
    const onClose = renderHeader()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders with no children', () => {
    render(<DialogHeader headingId="h" heading="Only" closeLabel="Close" onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Only' })).toBeTruthy()
  })
})
