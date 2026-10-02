import { focusManager } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryProvider } from '../QueryProvider'

describe('QueryProvider', () => {
  it('refetches on window focus while mounted', () => {
    const { unmount } = render(
      <QueryProvider>
        <p>child</p>
      </QueryProvider>
    )
    const listener = vi.fn()
    const unsubscribe = focusManager.subscribe(listener)

    window.dispatchEvent(new Event('focus'))

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    unmount()
  })

  it('stops listening for window focus once unmounted', () => {
    const { unmount } = render(
      <QueryProvider>
        <p>child</p>
      </QueryProvider>
    )
    const listener = vi.fn()
    const unsubscribe = focusManager.subscribe(listener)

    unmount()
    window.dispatchEvent(new Event('focus'))

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
