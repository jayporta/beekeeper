import type { BrowserWindowConstructorOptions } from 'electron'

/** The title bar's height in pixels. It matches `--size-titlebar` in the renderer's tokens. */
export const TITLE_BAR_HEIGHT = 48

/** The height of a macOS traffic light button, which the light position centers. */
const TRAFFIC_LIGHT_SIZE = 14

/** The title bar part of a window's options. */
type WindowChromeOptions = Pick<
  BrowserWindowConstructorOptions,
  'titleBarStyle' | 'titleBarOverlay' | 'trafficLightPosition'
>

/**
 * The window options that put the page under the title bar on macOS: the
 * traffic lights float over the page's own bar, and the overlay exposes the
 * bar's size to the page as `env(titlebar-area-*)`. Other platforms keep the
 * native frame.
 *
 * @param platform - The platform the app runs on.
 * @returns The options to spread into the window's constructor options.
 */
export function windowChromeOptions(platform: NodeJS.Platform): WindowChromeOptions {
  if (platform !== 'darwin') return {}
  return {
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: { height: TITLE_BAR_HEIGHT },
    trafficLightPosition: { x: 16, y: (TITLE_BAR_HEIGHT - TRAFFIC_LIGHT_SIZE) / 2 }
  }
}
