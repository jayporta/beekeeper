import type { BrowserWindow } from 'electron'
import { vi } from 'vitest'

/** A stand-in for a window, with the calls made on it recorded for assertions. */
export interface FakeWindow {
  readonly window: BrowserWindow
  /** The order of the window calls made, with `send:<argument count>` for each send. */
  readonly calls: string[]
  readonly send: ReturnType<typeof vi.fn>
  /** Finishes the page load, as Electron does by emitting `did-finish-load`. */
  finishLoad(): void
  /** Destroys the window's web contents. */
  destroy(): void
  /** The events the window was asked to wait for once. */
  readonly waitedFor: string[]
}

/** A window stub that records the order of the calls made on it. */
export function fakeWindow({
  minimized = false,
  destroyed = false,
  loading = false
}: { minimized?: boolean; destroyed?: boolean; loading?: boolean } = {}): FakeWindow {
  const calls: string[] = []
  const waitedFor: string[] = []
  const handlers: (() => void)[] = []
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
      once: (event: string, handler: () => void) => {
        waitedFor.push(event)
        handlers.push(handler)
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
      isLoading = false
      for (const handler of handlers.splice(0)) handler()
    },
    destroy: () => {
      isDestroyed = true
    }
  }
}
