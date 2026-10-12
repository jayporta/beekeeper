import { listProjects } from '../../service/projects/listProjects'
import { listSessions } from '../../service/sessions/listSessions'
import { IPC_CHANNELS, type IpcChannel } from '../../shared/ipc/channels'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import {
  getSessionRequestSchema,
  getWorktreePatchRequestSchema,
  listSessionsRequestSchema
} from '../../shared/ipc/requestSchemas'
import { copyTextHandler } from './copyTextHandler'
import { getOtelReceiverHandler } from './getOtelReceiverHandler'
import { getProjectDailyUsageHandler } from './getProjectDailyUsageHandler'
import { getProjectTotalsHandler } from './getProjectTotalsHandler'
import { getReportedCostHandler } from './getReportedCostHandler'
import { getSession } from '../../service/sessionDetail/getSession'
import { getWorktreeDiffs } from '../../service/worktrees/getWorktreeDiffs'
import { getWorktreePatch } from '../../service/worktrees/getWorktreePatch'
import { guardIpc } from './guardIpc'
import type { IpcDeps } from './ipcDeps'
import { parseThen } from './parseThen'
import type { SenderEvent } from './senderValidation'
import { setOtelReceiverEnabledHandler } from './setOtelReceiverEnabledHandler'

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
 * Registers the IPC handlers. Call it once, after the app is ready and
 * before any window is created, since registering a channel twice throws.
 * @param options - `ipcMain`, the sender check, and the handlers' dependencies.
 */
export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const { ipcMain, isTrusted, deps } = options
  const handlers: Record<IpcChannel, (payload: unknown) => Promise<IpcResult<unknown>>> = {
    [IPC_CHANNELS.listProjects]: () => listProjects(deps),
    [IPC_CHANNELS.listSessions]: parseThen({
      schema: listSessionsRequestSchema,
      run: (request) => listSessions(deps, request)
    }),
    [IPC_CHANNELS.getSession]: parseThen({
      schema: getSessionRequestSchema,
      run: (request) => getSession(deps, request)
    }),
    [IPC_CHANNELS.getWorktreeDiffs]: parseThen({
      schema: getSessionRequestSchema,
      run: (request) => getWorktreeDiffs(deps, request)
    }),
    [IPC_CHANNELS.getProjectTotals]: (payload) => getProjectTotalsHandler(deps, payload),
    [IPC_CHANNELS.getProjectDailyUsage]: (payload) => getProjectDailyUsageHandler(deps, payload),
    [IPC_CHANNELS.getWorktreePatch]: parseThen({
      schema: getWorktreePatchRequestSchema,
      run: (request) => getWorktreePatch(deps, request)
    }),
    [IPC_CHANNELS.getOtelReceiver]: () => getOtelReceiverHandler(deps),
    [IPC_CHANNELS.setOtelReceiverEnabled]: (payload) =>
      setOtelReceiverEnabledHandler(deps, payload),
    [IPC_CHANNELS.getReportedCost]: (payload) => getReportedCostHandler(deps, payload),
    [IPC_CHANNELS.copyText]: (payload) => copyTextHandler(deps, payload)
  }
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.handle(channel, guardIpc({ isTrusted, handle: handlers[channel] }))
  }
}
