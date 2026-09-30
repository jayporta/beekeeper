import { vi } from 'vitest'

/** The user agent Electron reports on macOS. */
export const MAC_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/152'

/** The user agent Electron reports on Linux. */
export const LINUX_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152'

/** The user agent Electron reports on Windows. */
export const WINDOWS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152'

/**
 * Makes `navigator.userAgent` report the given value until mocks are restored.
 *
 * @param userAgent - The user agent to report.
 */
export function stubUserAgent(userAgent: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
}
