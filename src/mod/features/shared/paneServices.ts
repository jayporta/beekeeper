import type { IpcResult } from '../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import type { GetSessionRequest, ListSessionsRequest } from '../../../shared/ipc/requestSchemas'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'

/** The service calls a refresh makes. */
export interface PaneServices {
  /** `listSessions` for a project folder. */
  listSessions(request: ListSessionsRequest): Promise<IpcResult<readonly SessionListItemDto[]>>
  /** `getSession` for one session. */
  getSession(request: GetSessionRequest): Promise<IpcResult<SessionDetailDto>>
  /** `listProjects`: the project folders, for Browse. */
  listProjects(): Promise<IpcResult<readonly ProjectDto[]>>
}
