import type { BrowserWindow } from 'electron'
import { IPC_EVENTS } from '../shared/ipc/channels'
import { surfaceWindows } from './surfaceWindows'

/**
 * Asks every live window to open its About dialog.
 *
 * Each window is surfaced first (see {@link surfaceWindows}), because a
 * minimized or hidden window still counts as open and the dialog would
 * otherwise appear where nobody sees it. A window that is still loading gets
 * the event once its page has loaded. The event carries no payload.
 *
 * @param windows - The open windows, such as `BrowserWindow.getAllWindows()`.
 */
export function sendOpenAbout(windows: readonly BrowserWindow[]): void {
  surfaceWindows(windows, (window) => {
    window.webContents.send(IPC_EVENTS.openAbout)
  })
}
