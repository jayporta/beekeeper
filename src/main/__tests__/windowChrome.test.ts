import { describe, expect, it } from 'vitest'
import { TITLE_BAR_HEIGHT, windowChromeOptions } from '../windowChrome'

describe('windowChromeOptions', () => {
  it('hides the macOS title bar and insets the traffic lights', () => {
    const options = windowChromeOptions('darwin')

    expect(options.titleBarStyle).toBe('hiddenInset')
    expect(options.titleBarOverlay).toEqual({ height: TITLE_BAR_HEIGHT })
  })

  it.each(['linux', 'win32'] as const)('keeps the native frame on %s', (platform) => {
    expect(windowChromeOptions(platform)).toEqual({})
  })

  it('makes the bar tall enough for a 44px target with padding', () => {
    expect(TITLE_BAR_HEIGHT).toBeGreaterThanOrEqual(44 + 4)
  })
})
