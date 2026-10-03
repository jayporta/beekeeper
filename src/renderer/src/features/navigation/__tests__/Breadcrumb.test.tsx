import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Breadcrumb } from '../Breadcrumb'

describe('Breadcrumb', () => {
  it('renders a labelled navigation landmark holding an ordered list of segments', () => {
    render(
      <Breadcrumb segments={[{ label: 'Sessions', onSelect: vi.fn() }, { label: 'Fix bug' }]} />
    )

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })

    expect(within(within(nav).getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
  })

  it('calls onSelect when an earlier segment is pressed', async () => {
    const onSelect = vi.fn()
    render(<Breadcrumb segments={[{ label: 'Sessions', onSelect }, { label: 'Fix bug' }]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sessions' }))

    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('marks the last segment as the current page and does not make it a button', () => {
    render(
      <Breadcrumb segments={[{ label: 'Sessions', onSelect: vi.fn() }, { label: 'Fix bug' }]} />
    )

    const current = screen.getByText('Fix bug')

    expect(current.getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Fix bug' })).toBeNull()
  })

  it('shows a lone segment as the current page', () => {
    render(<Breadcrumb segments={[{ label: 'Sessions' }]} />)

    expect(screen.getByText('Sessions').getAttribute('aria-current')).toBe('page')
  })

  it('shows an earlier segment without onSelect as plain text', () => {
    render(<Breadcrumb segments={[{ label: 'Project' }, { label: 'Fix bug' }]} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Project').getAttribute('aria-current')).toBeNull()
  })

  it('renders a label that looks like markup as plain text', () => {
    render(<Breadcrumb segments={[{ label: '<img src=x onerror=alert(1)>' }]} />)

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
  })
})
