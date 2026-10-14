import type { IpcErrorCode } from '../../../shared/ipc/ipcResult'

/** Why a view has no data: a service failure's code, or the mod's own when it can't start. */
export type PaneErrorCode = IpcErrorCode | 'too-old' | 'start-failed'
