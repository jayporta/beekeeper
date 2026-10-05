import { focusManager, useIsRestoring } from '@tanstack/react-query'
import { render, screen, type RenderResult } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryProvider } from '../QueryProvider'

/** Shows a marker once the saved cache has been restored. */
function RestoredMarker(): React.JSX.Element | null {
  return useIsRestoring() ? null : <p>restored</p>
}

/**
 * Renders the provider and waits for its IndexedDB restore to settle, so the
 * restore can't finish after the test environment is torn down.
 */
async function renderRestored(): Promise<RenderResult> {
  const result = render(
    <QueryProvider>
      <RestoredMarker />
    </QueryProvider>
  )
  await screen.findByText('restored')
  return result
}

describe('QueryProvider', () => {
  it('refetches on window focus while mounted', async () => {
    const { unmount } = await renderRestored()
    const listener = vi.fn()
    const unsubscribe = focusManager.subscribe(listener)

    window.dispatchEvent(new Event('focus'))

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    unmount()
  })

  it('stops listening for window focus once unmounted', async () => {
    const { unmount } = await renderRestored()
    const listener = vi.fn()
    const unsubscribe = focusManager.subscribe(listener)

    unmount()
    window.dispatchEvent(new Event('focus'))

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
