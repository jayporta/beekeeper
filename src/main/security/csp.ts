const PRODUCTION_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

/**
 * Builds the Content-Security-Policy header applied to every response.
 * With no dev server, this is the strict production policy: no network
 * access at all. With a dev server URL, script-src, style-src, and
 * connect-src are widened just enough for Vite's HMR client, the React
 * refresh preamble, and the HMR websocket, scoped to that origin only.
 *
 * @param devServerUrl - The Vite dev server origin in development, or `undefined` in production.
 * @returns The policy string for the `Content-Security-Policy` header.
 */
export function buildContentSecurityPolicy(devServerUrl: string | undefined): string {
  if (!devServerUrl) return PRODUCTION_CSP

  const httpOrigin = new URL(devServerUrl).origin
  const wsOrigin = httpOrigin.replace(/^http/, 'ws')

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${httpOrigin}`,
    `style-src 'self' 'unsafe-inline' ${httpOrigin}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${httpOrigin} ${wsOrigin}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ')
}
