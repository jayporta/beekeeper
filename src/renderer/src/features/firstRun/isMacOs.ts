/**
 * Whether the app is running on macOS. The renderer has no Node access, so
 * this reads the user agent, which Electron sets to include `Macintosh` there.
 *
 * @returns `true` on macOS.
 */
export function isMacOS(): boolean {
  return navigator.userAgent.includes('Macintosh')
}
