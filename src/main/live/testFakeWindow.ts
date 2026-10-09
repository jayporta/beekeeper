import type { BrowserWindow } from 'electron'
import { vi } from 'vitest'

/** A stub window, as {@link fakeWindow} builds it. */
export interface FakeWindow {
  /** The stub, typed as the window the code under test receives. */
  readonly window: BrowserWindow
  /** Every `webContents.send` call, as `[channel, ...payload]`. */
  readonly send: ReturnType<typeof vi.fn>
  /**
   * Finishes a page load. As in Electron, `did-finish-load` handlers run while
   * the web contents still report loading, which ends just after them.
   */
  finishLoad(): void
  /** Destroys the window's web contents. */
  destroy(): void
}

/**
 * A window stub with just the `webContents` parts the live-update code uses:
 * `send`, `isDestroyed`, `isLoading` and `on`/`once` for `did-finish-load`.
 *
 * @param state - Set `loading` for a window whose page is still loading, `destroyed` for one already gone.
 * @returns The stub and handles to drive it.
 */
export function fakeWindow(state: { loading?: boolean; destroyed?: boolean } = {}): FakeWindow {
  let loading = state.loading ?? false
  let destroyed = state.destroyed ?? false
  const handlers = new Set<() => void>()
  const onceHandlers = new Set<() => void>()
  const send = vi.fn()
  const window = {
    webContents: {
      isDestroyed: () => destroyed,
      isLoading: () => loading,
      on: (_event: string, handler: () => void) => handlers.add(handler),
      once: (_event: string, handler: () => void) => onceHandlers.add(handler),
      send
    }
  } as unknown as BrowserWindow
  return {
    window,
    send,
    finishLoad: () => {
      const once = [...onceHandlers]
      onceHandlers.clear()
      for (const handler of [...handlers, ...once]) handler()
      loading = false
    },
    destroy: () => {
      destroyed = true
    }
  }
}
