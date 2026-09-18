import { session as electronSession } from 'electron'
import { buildContentSecurityPolicy } from './csp'
import { isAllowedRequestUrl, type RequestAllowlistOptions } from './requestAllowlist'

/**
 * Wires the network kill switch, permission denial, and Content-Security-
 * Policy onto the default session. This is the enforcement behind
 * Beekeeper's no-network promise: every request other than the app's own
 * bundled files or, in development, the Vite dev server, is canceled
 * before it leaves the process, and every permission prompt (camera,
 * microphone, geolocation, notifications, and the rest) is refused.
 *
 * @param options - Where the app's bundled files live and, in development, the dev server origin.
 */
export function hardenDefaultSession(options: RequestAllowlistOptions): void {
  const { devServerUrl } = options
  const defaultSession = electronSession.defaultSession

  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  defaultSession.setPermissionCheckHandler(() => false)

  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRequestUrl(details.url, options) })
  })

  const contentSecurityPolicy = buildContentSecurityPolicy(devServerUrl)
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy]
      }
    })
  })
}
