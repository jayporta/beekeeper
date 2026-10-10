import { app, BrowserWindow, clipboard, ipcMain, Menu } from 'electron'
import { existsSync, watch } from 'node:fs'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createAppArchiver } from './archive/createAppArchiver'
import { openArchiveStore } from './archive/openArchiveStore'
import { wireArchiver } from './archive/wireArchiver'
import { buildAppMenuTemplate } from './appMenu'
import { createIpcDeps } from './ipc/createIpcDeps'
import { sendOtelReceiverChanged } from './otel/sendOtelReceiverChanged'
import { wireOtelReceiver } from './otel/wireOtelReceiver'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { isTrustedSender } from './ipc/senderValidation'
import { createProjectsWatcher } from './live/createProjectsWatcher'
import { hardenDefaultSession } from './security/session'
import { hardenWebContents } from './security/windowSecurity'
import { sendOpenAbout } from './sendOpenAbout'
import { surfaceWindows } from './surfaceWindows'
import { describeError } from './describeError'
import { isFatalLoadFailure } from './startupFailure'

// An empty value counts as unset, so every check below agrees on it.
const devServerUrl = (is.dev && process.env['ELECTRON_RENDERER_URL']) || undefined
// Developer Tools only with a dev server, matching the request allowlist.
const devToolsEnabled = devServerUrl !== undefined
const rendererRoot = join(__dirname, '../renderer')

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 560,
    show: false,
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
  return mainWindow
}

/**
 * The open windows, or a new one when none is open (macOS keeps the app
 * running with no window). A new window is still loading, so the callers hold
 * their request until its page has loaded.
 */
function openOrNewWindows(): BrowserWindow[] {
  const windows = BrowserWindow.getAllWindows()
  return windows.length === 0 ? [createWindow()] : windows
}

function openAbout(): void {
  sendOpenAbout(openOrNewWindows())
}

// Must run before the app is ready.
app.enableSandbox()

// One running copy at a time: a second would share the receiver settings file
// and the archive database while running its own server. Dev builds skip the
// lock, since a reload could lose it to the exiting process and dev and
// packaged builds probably share a userData folder.
if (!is.dev && !app.requestSingleInstanceLock()) {
  console.error('beekeeper is already running, so this copy quits.')
  app.quit()
} else {
  app
    .whenReady()
    .then(() => {
      hardenDefaultSession({ rendererRoot, devServerUrl })

      // The opt-in telemetry receiver: off unless the saved setting is on.
      const otel = wireOtelReceiver({
        settingsPath: join(app.getPath('userData'), 'otel-receiver.json'),
        host: {
          onWillQuit: (listener) => app.on('will-quit', listener),
          notifyReceiverChanged: () => sendOtelReceiverChanged(BrowserWindow.getAllWindows())
        }
      })
      const archive = openArchiveStore(join(app.getPath('userData'), 'archive.sqlite'))
      const deps = {
        ...createIpcDeps(app.getPath('home')),
        otel,
        copyToClipboard: (text: string) => clipboard.writeText(text),
        archive
      }

      // Registered once, before any window: `activate` recreates windows, and a
      // channel can't be registered twice.
      registerIpcHandlers({
        ipcMain,
        isTrusted: (event) => isTrustedSender(event, { rendererRoot, devServerUrl }),
        deps
      })

      // One watcher for the app's lifetime, on the same root the handlers read.
      const projectsWatcher = createProjectsWatcher({
        root: deps.projectsRoot,
        watch,
        exists: existsSync,
        windows: () => BrowserWindow.getAllWindows()
      })
      app.on('will-quit', () => {
        projectsWatcher.close()
      })

      // Set once, before any window: `activate` recreates windows, not the menu.
      Menu.setApplicationMenu(
        Menu.buildFromTemplate(
          buildAppMenuTemplate({
            platform: process.platform,
            devTools: devToolsEnabled,
            onAbout: openAbout
          })
        )
      )

      app.on('browser-window-created', (_, window) => {
        // `zoom: true` keeps the toolkit from cancelling the zoom keys. Cancelling
        // a key event in the window also blocks the matching menu accelerator.
        optimizer.watchWindowShortcuts(window, { zoom: true })
        projectsWatcher.notifyWindow(window)
        // A recursive watch can walk a large tree before it returns, so it starts after the
        // first page has loaded and painted. Starting again does nothing.
        window.webContents.once('did-finish-load', () => {
          setImmediate(() => {
            projectsWatcher.start()
          })
        })
      })

      const firstWindow = createWindow()
      if (archive !== null) {
        wireArchiver({
          archiver: createAppArchiver({ deps, store: archive }),
          close: () => archive.close(),
          host: {
            onFirstWindowLoaded: (listener) =>
              firstWindow.webContents.once('did-finish-load', listener),
            onWillQuit: (listener) => app.once('will-quit', listener)
          }
        })
      }

      // A second launch quits itself (see the lock above) and signals this copy.
      app.on('second-instance', () => {
        surfaceWindows(openOrNewWindows())
      })

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
}

// Quit when all windows are closed, except on macOS, where apps stay
// active in the dock until the user quits explicitly with Cmd+Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
