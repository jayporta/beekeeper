import { IPC_CHANNELS, type IpcChannel } from '../../shared/ipc/channels'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { getSessionHandler } from './getSessionHandler'
import { guardIpc } from './guardIpc'
import type { IpcDeps } from './ipcDeps'
import { listProjectsHandler } from './listProjectsHandler'
import { listSessionsHandler } from './listSessionsHandler'
import type { SenderEvent } from './senderValidation'

/** The part of Electron's `ipcMain` that registration uses. */
export interface IpcMainLike {
  /** Registers the single handler for `channel`. Registering a channel twice throws. */
  handle(
    channel: string,
    listener: (event: SenderEvent, payload?: unknown) => Promise<unknown>
  ): void
}

/** Options for {@link registerIpcHandlers}. */
export interface RegisterIpcHandlersOptions {
  /** Electron's `ipcMain`, or a fake in tests. */
  readonly ipcMain: IpcMainLike
  /** Decides whether an invoke came from the app's own page. */
  readonly isTrusted: (event: SenderEvent) => boolean
  /** What the handlers read from. */
  readonly deps: IpcDeps
}

/**
 * Registers the three IPC handlers. Call it once, after the app is ready and
 * before any window is created, since registering a channel twice throws.
 * @param options - `ipcMain`, the sender check, and the handlers' dependencies.
 */
export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const { ipcMain, isTrusted, deps } = options
  const handlers: Record<IpcChannel, (payload: unknown) => Promise<IpcResult<unknown>>> = {
    [IPC_CHANNELS.listProjects]: () => listProjectsHandler(deps),
    [IPC_CHANNELS.listSessions]: (payload) => listSessionsHandler(deps, payload),
    [IPC_CHANNELS.getSession]: (payload) => getSessionHandler(deps, payload)
  }
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.handle(channel, guardIpc({ isTrusted, handle: handlers[channel] }))
  }
}
