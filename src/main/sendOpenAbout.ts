import type { BrowserWindow } from 'electron'
import { IPC_EVENTS } from '../shared/ipc/channels'

/**
 * Asks every live window to open its About dialog.
 *
 * Each window is restored if minimized, then shown and focused, because a
 * minimized or hidden window still counts as open and the dialog would
 * otherwise appear where nobody sees it. The event carries no payload.
 *
 * @param windows - The open windows, such as `BrowserWindow.getAllWindows()`.
 */
export function sendOpenAbout(windows: readonly BrowserWindow[]): void {
  for (const window of windows) {
    if (window.webContents.isDestroyed()) continue
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    window.webContents.send(IPC_EVENTS.openAbout)
  }
}
