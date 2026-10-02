import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RefreshButton } from '../RefreshButton'

describe('RefreshButton', () => {
  it('calls onRefresh when clicked', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} status="idle" />)

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('names itself Refreshing while a refresh runs', () => {
    render(<RefreshButton onRefresh={vi.fn()} status="refreshing" />)

    expect(screen.queryByRole('button', { name: 'Refreshing' })).not.toBeNull()
  })

  it('ignores a click while a refresh runs', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} status="refreshing" />)

    await userEvent.click(screen.getByRole('button', { name: 'Refreshing' }))

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('marks itself busy without leaving the tab order while a refresh runs', async () => {
    render(<RefreshButton onRefresh={vi.fn()} status="refreshing" />)

    const button = screen.getByRole('button', { name: 'Refreshing' })
    await userEvent.tab()

    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(button)
  })

  it('keeps focus on the button after a click', async () => {
    render(<RefreshButton onRefresh={vi.fn()} status="idle" />)

    const button = screen.getByRole('button', { name: 'Refresh' })
    await userEvent.click(button)

    expect(document.activeElement).toBe(button)
  })

  it('announces that the lists were updated once a refresh has finished', () => {
    render(<RefreshButton onRefresh={vi.fn()} status="refreshed" />)

    expect(screen.getByRole('status').textContent).toBe('Lists updated')
  })

  it('announces nothing before a refresh has finished', () => {
    render(<RefreshButton onRefresh={vi.fn()} status="idle" />)

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows and announces that the refresh failed, beside a button that is ready again', () => {
    render(<RefreshButton onRefresh={vi.fn()} status="failed" />)

    const note = screen.getByRole('status')
    expect(note.textContent).toBe("Couldn't refresh. Showing the last loaded lists.")
    expect(note.className).not.toContain('visuallyHidden')
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeNull()
  })

  it('keeps the success announcement visually hidden', () => {
    render(<RefreshButton onRefresh={vi.fn()} status="refreshed" />)

    expect(screen.getByRole('status').className).toContain('visuallyHidden')
  })

  it('calls onRefresh when clicked after a failure', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} status="failed" />)

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
