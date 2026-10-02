import { focusManager } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerWindowFocusRefetch } from '../windowFocusRefetch'

let unregister: (() => void) | undefined

afterEach(() => {
  // focusManager is a module singleton, so every test removes what it registered.
  unregister?.()
  unregister = undefined
  vi.restoreAllMocks()
})

/** Subscribes to the focus manager the way a query does, returning the spy it notifies. */
function watchFocusManager(): ReturnType<typeof vi.fn> {
  const listener = vi.fn()
  focusManager.subscribe(listener)
  return listener
}

describe('registerWindowFocusRefetch', () => {
  it('notifies the focus manager when the window gains focus', () => {
    unregister = registerWindowFocusRefetch()
    const listener = watchFocusManager()

    window.dispatchEvent(new Event('focus'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies the focus manager when the page becomes visible', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    unregister = registerWindowFocusRefetch()
    const listener = watchFocusManager()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify the focus manager when the page becomes hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    unregister = registerWindowFocusRefetch()
    const listener = watchFocusManager()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying after the returned cleanup runs', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const cleanup = registerWindowFocusRefetch()
    const listener = watchFocusManager()

    cleanup()
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(listener).not.toHaveBeenCalled()
  })
})
