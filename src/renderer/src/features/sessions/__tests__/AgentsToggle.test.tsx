import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentsToggle } from '../AgentsToggle'

describe('AgentsToggle', () => {
  it('is named by the agent count, without its glyph', () => {
    render(
      <AgentsToggle expanded={false} onToggle={vi.fn()}>
        2 teammates
      </AgentsToggle>
    )

    expect(screen.getByRole('button', { name: '2 teammates' })).toBeTruthy()
  })

  it('reports whether the teammates show', () => {
    const { rerender } = render(
      <AgentsToggle expanded={false} onToggle={vi.fn()}>
        2 teammates
      </AgentsToggle>
    )
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false')

    rerender(
      <AgentsToggle expanded onToggle={vi.fn()}>
        2 teammates
      </AgentsToggle>
    )
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
  })

  it('points at the teammate list only when given its id', () => {
    const { rerender } = render(
      <AgentsToggle expanded onToggle={vi.fn()} controls="list">
        2 teammates
      </AgentsToggle>
    )
    expect(screen.getByRole('button').getAttribute('aria-controls')).toBe('list')

    rerender(
      <AgentsToggle expanded={false} onToggle={vi.fn()}>
        2 teammates
      </AgentsToggle>
    )
    expect(screen.getByRole('button').hasAttribute('aria-controls')).toBe(false)
  })

  it('calls onToggle when pressed', async () => {
    const onToggle = vi.fn()
    render(
      <AgentsToggle expanded={false} onToggle={onToggle}>
        2 teammates
      </AgentsToggle>
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledOnce()
  })
})
