import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { buildAppMenuTemplate } from './appMenu'
import { createIpcDeps } from './ipc/createIpcDeps'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { isTrustedSender } from './ipc/senderValidation'
import { hardenDefaultSession } from './security/session'
import { hardenWebContents } from './security/windowSecurity'
import { describeError } from './describeError'
import { isFatalLoadFailure } from './startupFailure'

// An empty value counts as unset, so every check below agrees on it.
const devServerUrl = (is.dev && process.env['ELECTRON_RENDERER_URL']) || undefined
// Developer Tools only with a dev server, matching the request allowlist.
const devToolsEnabled = devServerUrl !== undefined
const rendererRoot = join(__dirname, '../renderer')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      devTools: devToolsEnabled,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  // Held directly: once the window is destroyed, `mainWindow.webContents` throws.
  const { webContents } = mainWindow
  hardenWebContents(webContents, devServerUrl)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const load = devServerUrl
    ? mainWindow.loadURL(devServerUrl)
    : mainWindow.loadFile(join(rendererRoot, 'index.html'))
  // Electron attaches a no-op handler to a load's rejection, so without this a
  // failed load leaves the hidden window hidden. A window closed or quit
  // mid-load was closed on purpose, and its webContents can't be queried.
  load.catch((error: unknown) => {
    if (webContents.isDestroyed()) return
    if (!isFatalLoadFailure(error, webContents.isLoadingMainFrame())) return
    console.error(`Beekeeper could not load its window (${describeError(error)}).`)
    app.exit(1)
  })
}

// Must run before the app is ready.
app.enableSandbox()

app
  .whenReady()
  .then(() => {
    hardenDefaultSession({ rendererRoot, devServerUrl })

    // Registered once, before any window: `activate` recreates windows, and a
    // channel can't be registered twice.
    registerIpcHandlers({
      ipcMain,
      isTrusted: (event) => isTrustedSender(event, { rendererRoot, devServerUrl }),
      deps: createIpcDeps(app.getPath('home'))
    })

    // Set once, before any window: `activate` recreates windows, not the menu.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        buildAppMenuTemplate({ platform: process.platform, devTools: devToolsEnabled })
      )
    )

    app.on('browser-window-created', (_, window) => {
      // `zoom: true` keeps the toolkit from cancelling the zoom keys. Cancelling
      // a key event in the window also blocks the matching menu accelerator.
      optimizer.watchWindowShortcuts(window, { zoom: true })
    })

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window when the dock icon is
      // clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error: unknown) => {
    console.error(`Beekeeper failed to start (${describeError(error)}).`)
    app.exit(1)
  })

// Quit when all windows are closed, except on macOS, where apps stay
// active in the dock until the user quits explicitly with Cmd+Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
