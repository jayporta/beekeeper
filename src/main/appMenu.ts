import type { MenuItemConstructorOptions } from 'electron'

/** Inputs that decide which menu items the application menu includes. */
export interface AppMenuOptions {
  /** The OS the app runs on. macOS gets an app menu, other platforms a File menu. */
  readonly platform: NodeJS.Platform
  /** Whether to include reload and Developer Tools items in the View menu. */
  readonly devTools: boolean
}

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

const macAppMenu: MenuItemConstructorOptions = {
  label: 'Beekeeper',
  submenu: [
    { role: 'about' },
    { type: 'separator' },
    { role: 'hide' },
    { role: 'hideOthers' },
    { role: 'unhide' },
    { type: 'separator' },
    { role: 'quit' }
  ]
}

/**
 * Builds the application menu template.
 *
 * Every item uses a built-in role, so the menu runs no code of its own, has no
 * Help menu, and opens no URLs. The reload and Developer Tools items appear
 * only when `devTools` is true.
 *
 * @param options - The platform and whether to include the developer items.
 * @returns A template for `Menu.buildFromTemplate`.
 * @example
 * Menu.setApplicationMenu(
 *   Menu.buildFromTemplate(buildAppMenuTemplate({ platform: process.platform, devTools: false }))
 * )
 */
export function buildAppMenuTemplate({
  platform,
  devTools
}: AppMenuOptions): MenuItemConstructorOptions[] {
  const first: MenuItemConstructorOptions =
    platform === 'darwin' ? macAppMenu : { role: 'fileMenu' }
  return [first, editMenu, viewMenu(devTools), { role: 'windowMenu' }]
}
