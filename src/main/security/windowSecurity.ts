import type { WebContents } from 'electron'
import { isDevServerUrl } from './requestAllowlist'

/**
 * Locks down a window's webContents against the usual Electron escape
 * hatches: every popup is denied outright, navigation away from the app's
 * own page (or, in development, the Vite dev server) is blocked, and
 * `<webview>` tags can't be attached.
 */
export function hardenWebContents(
  webContents: WebContents,
  devServerUrl: string | undefined
): void {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  webContents.on('will-navigate', (event, url) => {
    if (isDevServerUrl(url, devServerUrl)) return
    event.preventDefault()
  })

  webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}
