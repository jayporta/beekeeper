import type { BrowserWindow } from 'electron'

/** One event for the renderer: a channel and an optional payload. */
export interface LiveEvent {
  /** The channel from `IPC_EVENTS`. */
  readonly channel: string
  /** The payload, left out for a signal. */
  readonly payload?: unknown
}

/**
 * Sends an event to every window that can receive it. A window whose web
 * contents are destroyed or still loading is skipped, since a loading window
 * fetches fresh data with its first queries.
 *
 * @param windows - The open windows, such as `BrowserWindow.getAllWindows()`.
 * @param event - The channel and payload to send.
 */
export function sendLiveEvent(windows: readonly BrowserWindow[], event: LiveEvent): void {
  for (const { webContents } of windows) {
    if (webContents.isDestroyed() || webContents.isLoading()) continue
    if ('payload' in event) webContents.send(event.channel, event.payload)
    else webContents.send(event.channel)
  }
}
