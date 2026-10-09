import { contextBridge, ipcRenderer } from 'electron'
import type { BeekeeperApi } from '../shared/ipc/beekeeperApi'
import { IPC_CHANNELS, IPC_EVENTS } from '../shared/ipc/channels'
import { createSignalRelay } from './createSignalRelay'

// Registered once as the preload loads, before the page has run any script, so a
// request made while the page loads is held until the dialog host subscribes.
const openAbout = createSignalRelay()
ipcRenderer.on(IPC_EVENTS.openAbout, () => {
  openAbout.signal()
})

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
  getProjectDailyUsage: (projectDirName, window) =>
    ipcRenderer.invoke(IPC_CHANNELS.getProjectDailyUsage, { projectDirName, window }),
  getWorktreePatch: (projectDirName, sessionId, agentId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorktreePatch, { projectDirName, sessionId, agentId }),
  getOtelReceiver: () => ipcRenderer.invoke(IPC_CHANNELS.getOtelReceiver),
  setOtelReceiverEnabled: (enabled) =>
    ipcRenderer.invoke(IPC_CHANNELS.setOtelReceiverEnabled, { enabled }),
  getReportedCost: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.getReportedCost, { sessionId }),
  copyText: (text) => ipcRenderer.invoke(IPC_CHANNELS.copyText, { text }),
  // The renderer learns only that About was requested, never the event.
  onOpenAbout: (listener) => openAbout.subscribe(listener)
}

contextBridge.exposeInMainWorld('beekeeper', api)
