import { detectPlatform } from './detectPlatform.js'

// The styles show the hero download that matches data-platform. Without this script no
// attribute is set, and every download shows.
document.documentElement.dataset.platform = detectPlatform({
  platform: navigator.userAgentData?.platform || navigator.platform || '',
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints ?? 0
})
