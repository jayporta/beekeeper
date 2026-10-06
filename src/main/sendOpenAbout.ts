import type { BrowserWindow } from 'electron'
import { IPC_EVENTS } from '../shared/ipc/channels'

function surfaceAndSend(window: BrowserWindow): void {
  if (window.webContents.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  window.webContents.send(IPC_EVENTS.openAbout)
}

/**
 * Asks every live window to open its About dialog.
 *
 * Each window is restored if minimized, then shown and focused, because a
 * minimized or hidden window still counts as open and the dialog would
 * otherwise appear where nobody sees it. A window that is still loading gets
 * all of that once its page has loaded, so a window that has not shown yet is
 * not shown early. The event carries no payload.
 *
 * @param windows - The open windows, such as `BrowserWindow.getAllWindows()`.
 */
export function sendOpenAbout(windows: readonly BrowserWindow[]): void {
  for (const window of windows) {
    if (window.webContents.isDestroyed()) continue
    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', () => {
        surfaceAndSend(window)
      })
    } else {
      surfaceAndSend(window)
    }
  }
}
