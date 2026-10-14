import type { IpcResult } from '../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { WorktreeDiffsDto } from '../../../shared/ipc/worktreeDiffDto'
import type { PaneServices } from './paneServices'

/** A fake {@link PaneServices} that records its calls. */
export interface TestPaneServices extends PaneServices {
  /** How many times `listSessions` was called. */
  listCalls: number
  /** How many times `getSession` was called. */
  getCalls: number
  /** How many times `listProjects` was called. */
  projectCalls: number
  /** How many times `getWorktreeDiffs` was called. */
  diffCalls: number
  /** The session each `getWorktreeDiffs` call asked for, in order, as `folder/id`. */
  diffedSessions: string[]
  /** The folder each `listSessions` call asked for, in order. */
  listedFolders: string[]
  /** The session each `getSession` call asked for, in order, as `folder/id`. */
  gotSessions: string[]
}

/**
 * Builds fake services that answer fixed results, or throw when given an `Error`.
 *
 * @param answers - What each service answers. `projects` defaults to no projects and `diffs` to no worktree agents.
 * @returns The services, with call counts.
 */
export function testPaneServices(answers: {
  readonly list: IpcResult<readonly SessionListItemDto[]> | Error
  readonly get: IpcResult<SessionDetailDto> | Error
  readonly projects?: IpcResult<readonly ProjectDto[]> | Error
  readonly diffs?: IpcResult<WorktreeDiffsDto> | Error
}): TestPaneServices {
  const services: TestPaneServices = {
    listCalls: 0,
    getCalls: 0,
    projectCalls: 0,
    diffCalls: 0,
    diffedSessions: [],
    listedFolders: [],
    gotSessions: [],
    listSessions: async (request) => {
      services.listCalls += 1
      services.listedFolders.push(request.projectDirName)
      if (answers.list instanceof Error) throw answers.list
      return answers.list
    },
    getSession: async (request) => {
      services.getCalls += 1
      services.gotSessions.push(`${request.projectDirName}/${request.sessionId}`)
      if (answers.get instanceof Error) throw answers.get
      return answers.get
    },
    getWorktreeDiffs: async (request) => {
      services.diffCalls += 1
      services.diffedSessions.push(`${request.projectDirName}/${request.sessionId}`)
      const diffs = answers.diffs ?? {
        ok: true as const,
        value: { git: 'ok' as const, agents: [], sharedWorktree: null }
      }
      if (diffs instanceof Error) throw diffs
      return diffs
    },
    listProjects: async () => {
      services.projectCalls += 1
      const projects = answers.projects ?? { ok: true as const, value: [] }
      if (projects instanceof Error) throw projects
      return projects
    }
  }
  return services
}
