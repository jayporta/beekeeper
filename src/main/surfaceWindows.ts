import type { BrowserWindow } from 'electron'

function surface(
  window: BrowserWindow,
  afterSurfaced: ((window: BrowserWindow) => void) | undefined
): void {
  if (window.webContents.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  afterSurfaced?.(window)
}

/**
 * Brings windows to the front: each is restored if minimized, then shown and
 * focused, because a minimized or hidden window still counts as open and would
 * otherwise sit where nobody sees it. A window that is still loading gets all
 * of that once its page has loaded, so a window that has not shown yet is not
 * shown blank. A window destroyed before then is skipped.
 *
 * @param windows - The windows to surface, such as `BrowserWindow.getAllWindows()`.
 * @param afterSurfaced - Called with each window once it has been shown and focused.
 */
export function surfaceWindows(
  windows: readonly BrowserWindow[],
  afterSurfaced?: (window: BrowserWindow) => void
): void {
  for (const window of windows) {
    if (window.webContents.isDestroyed()) continue
    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', () => {
        surface(window, afterSurfaced)
      })
    } else {
      surface(window, afterSurfaced)
    }
  }
}
