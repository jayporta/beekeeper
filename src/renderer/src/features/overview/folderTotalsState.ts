import type { IpcErrorCode } from '../../../../shared/ipc/ipcResult'
import type { ProjectTotalsDto } from '../../../../shared/ipc/projectTotalsDto'

/** Where one folder's totals stand. */
export type FolderTotalsState =
  | {
      /** The totals haven't arrived and there are none to show in their place. */
      readonly status: 'loading'
    }
  | {
      /** The folder's totals couldn't be loaded. */
      readonly status: 'error'
      /** Why, as a code. */
      readonly code: IpcErrorCode
    }
  | {
      /** The folder's totals. */
      readonly status: 'ready'
      /** The totals. */
      readonly totals: ProjectTotalsDto
      /** Whether these are the other window's figures, shown until this window's arrive. */
      readonly refreshing: boolean
    }

/** The state of a folder whose totals haven't arrived. */
export const LOADING: FolderTotalsState = { status: 'loading' }
