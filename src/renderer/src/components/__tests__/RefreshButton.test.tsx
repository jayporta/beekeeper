import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RefreshButton } from '../RefreshButton'

describe('RefreshButton', () => {
  it('calls onRefresh when clicked', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} refreshing={false} refreshed={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('names itself Refreshing while a refresh runs', () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing refreshed={false} />)

    expect(screen.queryByRole('button', { name: 'Refreshing' })).not.toBeNull()
  })

  it('ignores a click while a refresh runs', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} refreshing refreshed={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Refreshing' }))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('marks itself busy without leaving the tab order while a refresh runs', async () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing refreshed={false} />)

    const button = screen.getByRole('button', { name: 'Refreshing' })
    await userEvent.tab()

    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(button)
  })

  it('keeps focus on the button after a click', async () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing={false} refreshed={false} />)

    const button = screen.getByRole('button', { name: 'Refresh' })
    await userEvent.click(button)

    expect(document.activeElement).toBe(button)
  })

  it('announces that the lists were updated once a refresh has finished', () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing={false} refreshed />)

    expect(screen.getByRole('status').textContent).toBe('Lists updated')
  })

  it('announces nothing before a refresh has finished', () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing={false} refreshed={false} />)

    expect(screen.getByRole('status').textContent).toBe('')
  })
})
