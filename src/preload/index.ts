import { contextBridge, ipcRenderer } from 'electron'
import type { BeekeeperApi } from '../shared/ipc/beekeeperApi'
import { IPC_CHANNELS, IPC_EVENTS } from '../shared/ipc/channels'

/**
 * The only thing exposed to the renderer: named wrappers that return just the
 * result, never `ipcRenderer` or the event object.
 */
const api: BeekeeperApi = {
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.listProjects),
  listSessions: (projectDirName) =>
    ipcRenderer.invoke(IPC_CHANNELS.listSessions, { projectDirName }),
  getSession: (projectDirName, sessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getSession, { projectDirName, sessionId }),
  getWorktreeDiffs: (projectDirName, sessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorktreeDiffs, { projectDirName, sessionId }),
  getProjectTotals: (projectDirName, window) =>
    ipcRenderer.invoke(IPC_CHANNELS.getProjectTotals, { projectDirName, window }),
  getWorktreePatch: (projectDirName, sessionId, agentId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorktreePatch, { projectDirName, sessionId, agentId }),
  onOpenAbout: (listener) => {
    // The event is dropped: the renderer learns only that About was requested.
    const handler = (): void => {
      listener()
    }
    ipcRenderer.on(IPC_EVENTS.openAbout, handler)
    return () => {
      ipcRenderer.removeListener(IPC_EVENTS.openAbout, handler)
    }
  }
}

contextBridge.exposeInMainWorld('beekeeper', api)
