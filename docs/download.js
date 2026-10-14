// A classic script, loaded in <head> without defer, so data-platform is set before the body paints
// and the hero never flashes every download. The styles show the download that matches it. Without
// this script no attribute is set, and every download shows.

/** Phones, tablets, and Chromebooks report a "Linux" or "Mac" platform but can't run either build. */
const UNSUPPORTED_DEVICE = /\b(android|iphone|ipad|ipod|cros|mobile)\b/i
/** An x64 machine, as `navigator.platform` reports it on Linux. */
const X64 = /x86_64|amd64/i

/**
 * @typedef {'mac' | 'linux' | 'other'} Platform
 * The download that fits a visitor: the Apple Silicon build, the x64 Linux build, or none of them.
 */

/**
 * Works out which download suits a visitor from what their browser reports.
 *
 * Browsers can't tell an Apple Silicon Mac from an Intel one, so `'mac'` stands for the Apple
 * Silicon build. iPadOS reports a Mac's platform with a touch screen, so a touch-capable "Mac" is
 * `'other'`. Chromium reports an x86_64 user agent even on Arm, so Linux is judged by
 * `navigator.platform` alone, and only an x86_64 or amd64 value gets the x64 build.
 * @param {{ os: string, platform: string, userAgent: string, maxTouchPoints: number }} browser - The
 * operating system from `navigator.userAgentData.platform` or else `navigator.platform`, then
 * `navigator.platform`, `navigator.userAgent`, and `navigator.maxTouchPoints`.
 * @returns {Platform} `'mac'` for a Mac, `'linux'` for x64 desktop Linux, and `'other'` for anything else.
 */
function detectPlatform({ os, platform, userAgent, maxTouchPoints }) {
  if (UNSUPPORTED_DEVICE.test(`${os} ${platform} ${userAgent}`)) return 'other'
  if (/mac/i.test(os)) return maxTouchPoints > 1 ? 'other' : 'mac'
  if (/linux/i.test(os) && X64.test(platform)) return 'linux'
  return 'other'
}

document.documentElement.dataset.platform = detectPlatform({
  os: navigator.userAgentData?.platform || navigator.platform || '',
  platform: navigator.platform || '',
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints ?? 0
})
