import { act } from '@testing-library/react'
import { vi } from 'vitest'

/** The stubbed `ResizeObserver`. */
interface ResizeObserverStub {
  /** Reports a resize to every observer that is still connected. */
  readonly resize: () => void
}

/**
 * Replaces the global `ResizeObserver` with one that reports only when told to,
 * since jsdom lays nothing out. Call it before rendering, because a component
 * creates its observer on mount, and call `vi.unstubAllGlobals()` in `afterEach`.
 *
 * @returns A handle whose `resize` runs every connected observer's callback inside `act`.
 */
export function stubResizeObserver(): ResizeObserverStub {
  const connected = new Set<StubResizeObserver>()

  class StubResizeObserver {
    constructor(readonly callback: ResizeObserverCallback) {}

    observe(): void {
      connected.add(this)
    }

    unobserve = (): undefined => undefined

    disconnect(): void {
      connected.delete(this)
    }
  }

  vi.stubGlobal('ResizeObserver', StubResizeObserver)

  return {
    resize: () => {
      act(() => {
        for (const observer of connected) observer.callback([], observer)
      })
    }
  }
}
