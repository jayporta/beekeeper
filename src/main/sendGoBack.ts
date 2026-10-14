import type { BrowserWindow } from 'electron'
import { IPC_EVENTS } from '../shared/ipc/channels'

/**
 * Asks one window to go back, as the View menu's Back item does. Only that
 * window gets the event, and it is not surfaced, because the person chose the
 * item from it. A window whose web contents are destroyed is skipped. The event
 * carries no payload.
 *
 * @param window - The window the menu item was chosen in.
 */
export function sendGoBack(window: BrowserWindow): void {
  if (window.webContents.isDestroyed()) return
  window.webContents.send(IPC_EVENTS.goBack)
}
