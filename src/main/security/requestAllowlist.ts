import { fileURLToPath } from 'url'
import { isAbsolute, relative } from 'path'

/**
 * Maps a URL scheme to the origin family it belongs to, so a websocket
 * scheme is recognized as equivalent to its matching http(s) scheme.
 */
const ORIGIN_FAMILY: Record<string, string> = {
  'http:': 'http:',
  'ws:': 'http:',
  'https:': 'https:',
  'wss:': 'https:'
}

/**
 * Checks whether `url` names the same origin as the dev server: same
 * hostname and port, with its websocket scheme treated as equivalent to
 * the matching http(s) scheme. A string that merely starts with the dev
 * server's URL (a subdomain suffix, a userinfo trick) does not match,
 * since both sides are parsed and compared by their actual origin. A
 * parse failure or a missing dev server both resolve to false.
 *
 * @param url - The URL being requested or navigated to.
 * @param devServerUrl - The Vite dev server origin in development, or `undefined` in production.
 * @returns Whether `url` belongs to the dev server's origin.
 */
export function isDevServerUrl(url: string, devServerUrl: string | undefined): boolean {
  if (!devServerUrl) return false

  let requested: URL
  let devServer: URL
  try {
    requested = new URL(url)
    devServer = new URL(devServerUrl)
  } catch {
    return false
  }

  const requestedFamily = ORIGIN_FAMILY[requested.protocol]
  const devServerFamily = ORIGIN_FAMILY[devServer.protocol]

  return (
    requestedFamily !== undefined &&
    requestedFamily === devServerFamily &&
    requested.hostname === devServer.hostname &&
    requested.port === devServer.port
  )
}

/**
 * Checks whether a `file:` URL resolves to a path inside `rendererRoot`,
 * so the network kill switch can't be tricked into serving an arbitrary
 * file on disk through a `..` traversal or an absolute-path escape.
 * `fileURLToPath` decodes percent-encoding; `relative` then normalizes
 * away any `..` segments before the containment check runs.
 */
export function isInsideRendererRoot(fileUrl: string, rendererRoot: string): boolean {
  let filePath: string
  try {
    filePath = fileURLToPath(fileUrl)
  } catch {
    return false
  }

  const relativePath = relative(rendererRoot, filePath)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

export interface RequestAllowlistOptions {
  /** Absolute path to the built renderer output directory. `file:` requests must resolve inside it. */
  rendererRoot: string
  /** The Vite dev server's origin in development, or undefined in production. */
  devServerUrl: string | undefined
}

/**
 * Decides whether a request may reach the network stack at all. This is
 * the predicate behind Beekeeper's no-network promise: only the app's own
 * bundled files under `rendererRoot`, and, in development, the Vite dev
 * server's own origin (its page load, assets, and HMR websocket) plus the
 * `devtools:` scheme, are allowed. Everything else, including any
 * external host, is denied. In production, `devtools:` is denied too.
 *
 * @param url - The URL of the outgoing request.
 * @param options - Where the app's bundled files live and, in development, the dev server origin.
 * @returns Whether the request may proceed.
 */
export function isAllowedRequestUrl(url: string, options: RequestAllowlistOptions): boolean {
  const { rendererRoot, devServerUrl } = options

  let requested: URL
  try {
    requested = new URL(url)
  } catch {
    return false
  }

  if (requested.protocol === 'file:') return isInsideRendererRoot(url, rendererRoot)
  if (requested.protocol === 'devtools:') return devServerUrl !== undefined

  const isHttpOrWebSocket = requested.protocol === 'http:' || requested.protocol === 'ws:'
  return isHttpOrWebSocket && isDevServerUrl(url, devServerUrl)
}
