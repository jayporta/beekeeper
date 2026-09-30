import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '../AppErrorBoundary'

function Thrower(): React.JSX.Element {
  throw new Error('secret transcript text')
}

beforeEach(() => {
  // React logs a caught render error to the console; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AppErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>
    )

    expect(screen.getByText('all good')).toBeTruthy()
  })

  it('renders a fallback alert when a child throws', () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('never renders the error message', () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>
    )

    expect(screen.queryByText(/secret transcript text/)).toBeNull()
  })

  it('renders the fallback inside the main landmark, as an alert', () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>
    )

    expect(within(screen.getByRole('main')).getByRole('alert')).toBeTruthy()
  })

  it('focuses the Reload button when the error is caught', () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>
    )

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reload' }))
  })

  it('calls onReload when Reload is pressed', async () => {
    const onReload = vi.fn()
    render(
      <AppErrorBoundary onReload={onReload}>
        <Thrower />
      </AppErrorBoundary>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(onReload).toHaveBeenCalledOnce()
  })
})
