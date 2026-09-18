import { session as electronSession } from 'electron'
import { buildContentSecurityPolicy } from './csp'
import { isAllowedRequestUrl } from './requestAllowlist'

export interface HardenSessionOptions {
  /** Absolute path to the built renderer output directory. `file:` requests must resolve inside it. */
  rendererRoot: string
  /** The Vite dev server's origin in development, or undefined in production. */
  devServerUrl: string | undefined
}

/**
 * Wires the network kill switch, permission denial, and Content-Security-
 * Policy onto the default session. This is the enforcement behind
 * Beekeeper's no-network promise: every request other than the app's own
 * bundled files or, in development, the Vite dev server, is canceled
 * before it leaves the process, and every permission prompt (camera,
 * microphone, geolocation, notifications, and the rest) is refused.
 */
export function hardenDefaultSession({ rendererRoot, devServerUrl }: HardenSessionOptions): void {
  const defaultSession = electronSession.defaultSession

  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  defaultSession.setPermissionCheckHandler(() => false)

  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRequestUrl(details.url, { rendererRoot, devServerUrl }) })
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
