import { contextBridge, ipcRenderer } from 'electron'
import type { BeekeeperApi } from '../shared/ipc/beekeeperApi'
import { IPC_CHANNELS } from '../shared/ipc/channels'

/**
 * The only thing exposed to the renderer: named wrappers that return just the
 * result, never `ipcRenderer` or the event object.
 */
const api: BeekeeperApi = {
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.listProjects),
  listSessions: (projectDirName) =>
    ipcRenderer.invoke(IPC_CHANNELS.listSessions, { projectDirName }),
  getSession: (projectDirName, sessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getSession, { projectDirName, sessionId })
}

contextBridge.exposeInMainWorld('beekeeper', api)
