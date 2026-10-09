import type { BrowserWindow } from 'electron'
import { vi } from 'vitest'

/** A stand-in for a window, with the calls made on it recorded for assertions. */
export interface FakeWindow {
  /** The stub, typed as a window to pass to the code under test. */
  readonly window: BrowserWindow
  /** The order of the window calls made, with `send:<argument count>` for each send. */
  readonly calls: string[]
  /** The web contents' `send`, to assert the channel and payload sent. */
  readonly send: ReturnType<typeof vi.fn>
  /**
   * Finishes a page load. As in Electron, `did-finish-load` handlers run while
   * the web contents still report loading, which ends just after them.
   */
  finishLoad(): void
  /** Destroys the window's web contents. */
  destroy(): void
  /** The events the window was asked to wait for once. */
  readonly waitedFor: string[]
}

/** The starting state of a {@link FakeWindow}. */
export interface FakeWindowState {
  /** Whether the window reports itself minimized. */
  minimized?: boolean
  /** Whether the web contents are already destroyed. */
  destroyed?: boolean
  /** Whether the page is still loading. */
  loading?: boolean
}

/**
 * A window stub that records the order of the calls made on it, with just the
 * parts the main-process code uses: `isMinimized`, `restore`, `show`, `focus`,
 * and the web contents' `send`, `isDestroyed`, `isLoading` and `on`/`once`.
 *
 * @param state - The window's starting state. Each flag defaults to false.
 * @returns The stub and handles to drive it.
 */
export function fakeWindow({
  minimized = false,
  destroyed = false,
  loading = false
}: FakeWindowState = {}): FakeWindow {
  const calls: string[] = []
  const waitedFor: string[] = []
  const handlers = new Set<() => void>()
  const onceHandlers = new Set<() => void>()
  let isDestroyed = destroyed
  let isLoading = loading
  const send = vi.fn((...args: unknown[]) => {
    calls.push(`send:${args.length}`)
  })
  const window = {
    isMinimized: () => minimized,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
    webContents: {
      isDestroyed: () => isDestroyed,
      isLoading: () => isLoading,
      on: (_event: string, handler: () => void) => handlers.add(handler),
      once: (event: string, handler: () => void) => {
        waitedFor.push(event)
        onceHandlers.add(handler)
      },
      send
    }
  } as unknown as BrowserWindow
  return {
    window,
    calls,
    send,
    waitedFor,
    finishLoad: () => {
      const once = [...onceHandlers]
      onceHandlers.clear()
      for (const handler of [...handlers, ...once]) handler()
      isLoading = false
    },
    destroy: () => {
      isDestroyed = true
    }
  }
}
