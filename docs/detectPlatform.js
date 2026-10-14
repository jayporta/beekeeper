/** Phones, tablets, and Chromebooks report a "Linux" or "Mac" platform but can't run either build. */
const UNSUPPORTED_DEVICE = /\b(android|iphone|ipad|ipod|cros|mobile)\b/i
/** Arm builds of Linux, which the x64 downloads don't cover. */
const ARM = /\b(aarch64|arm64|armv\d)/i

/**
 * @typedef {'mac' | 'linux' | 'other'} Platform
 * The download that fits a visitor: the Apple Silicon build, an x64 Linux build, or none of them.
 */

/**
 * Works out which download suits a visitor from what their browser reports.
 *
 * Browsers can't tell an Apple Silicon Mac from an Intel one, so `'mac'` stands for the Apple
 * Silicon build. iPadOS reports a Mac's platform with a touch screen, so a touch-capable "Mac" is
 * treated as `'other'`.
 * @param {{ platform: string, userAgent: string, maxTouchPoints: number }} browser - The platform
 * from `navigator.userAgentData.platform` or `navigator.platform`, the user agent string, and
 * `navigator.maxTouchPoints`.
 * @returns {Platform} `'mac'` for a Mac, `'linux'` for x64 desktop Linux, and `'other'` for anything else.
 */
export function detectPlatform({ platform, userAgent, maxTouchPoints }) {
  if (UNSUPPORTED_DEVICE.test(`${platform} ${userAgent}`)) return 'other'
  if (/mac/i.test(platform)) return maxTouchPoints > 1 ? 'other' : 'mac'
  if (/linux/i.test(platform) && !ARM.test(`${platform} ${userAgent}`)) return 'linux'
  return 'other'
}
