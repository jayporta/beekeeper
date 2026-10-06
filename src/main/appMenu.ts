import type { MenuItemConstructorOptions } from 'electron'

/** Inputs that decide which menu items the application menu includes. */
export interface AppMenuOptions {
  /** The OS the app runs on. macOS adds an app menu before the File menu. */
  readonly platform: NodeJS.Platform
  /** Whether to include reload and Developer Tools items in the View menu. */
  readonly devTools: boolean
  /** Called when the user picks About beekeeper from the app menu or the Help menu. */
  readonly onAbout: () => void
}

const ABOUT_LABEL = 'About beekeeper'

const editMenu: MenuItemConstructorOptions = {
  label: 'Edit',
  submenu: [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'selectAll' }
  ]
}

function viewMenu(devTools: boolean): MenuItemConstructorOptions {
  const devItems: MenuItemConstructorOptions[] = devTools
    ? [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' }
      ]
    : []
  return {
    label: 'View',
    submenu: [
      ...devItems,
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      // Zoom in without Shift: the visible item's accelerator is Ctrl/Cmd+Shift+=.
      { role: 'zoomIn', accelerator: 'CommandOrControl+=', visible: false },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
}

function aboutItem(onAbout: () => void): MenuItemConstructorOptions {
  return {
    label: ABOUT_LABEL,
    click: () => {
      onAbout()
    }
  }
}

function macAppMenu(onAbout: () => void): MenuItemConstructorOptions {
  return {
    label: 'beekeeper',
    submenu: [
      aboutItem(onAbout),
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }
}

/**
 * Builds the application menu template.
 *
 * Every item uses a built-in role except the two About items, which only call
 * `onAbout`. The menu opens no URLs. The reload and Developer Tools items
 * appear only when `devTools` is true.
 *
 * @param options - The platform, whether to include the developer items, and the About handler.
 * @returns A template for `Menu.buildFromTemplate`.
 * @example
 * Menu.setApplicationMenu(
 *   Menu.buildFromTemplate(buildAppMenuTemplate({ platform: process.platform, devTools: false, onAbout }))
 * )
 */
export function buildAppMenuTemplate({
  platform,
  devTools,
  onAbout
}: AppMenuOptions): MenuItemConstructorOptions[] {
  // The file menu is Close on macOS, where it follows the app menu, and Quit elsewhere.
  const leading: MenuItemConstructorOptions[] =
    platform === 'darwin' ? [macAppMenu(onAbout), { role: 'fileMenu' }] : [{ role: 'fileMenu' }]
  return [
    ...leading,
    editMenu,
    viewMenu(devTools),
    { role: 'windowMenu' },
    { role: 'help', submenu: [aboutItem(onAbout)] }
  ]
}
