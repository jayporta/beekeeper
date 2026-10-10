import type { BrowserWindow } from 'electron'
import { IPC_EVENTS } from '../../shared/ipc/channels'

/**
 * Tells every window that the telemetry receiver's state changed, so each reads it again.
 * The event carries no payload.
 *
 * @remarks Unlike `sendLiveEvent`, this includes a window that is still loading: it may
 * already have read the receiver as listening, its preload relay holds the signal for the
 * page, and a page whose preload hasn't run yet hasn't read the receiver either.
 *
 * @param windows - The open windows, such as `BrowserWindow.getAllWindows()`.
 */
export function sendOtelReceiverChanged(windows: readonly BrowserWindow[]): void {
  for (const { webContents } of windows) {
    if (!webContents.isDestroyed()) webContents.send(IPC_EVENTS.otelReceiverChanged)
  }
}
