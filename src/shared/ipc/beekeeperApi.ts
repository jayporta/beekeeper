import type { IpcResult } from './ipcResult'
import type { ProjectDto } from './projectDto'
import type { SessionDetailDto } from './sessionDetailDto'
import type { SessionListItemDto } from './sessionListDto'
import type { WorktreeDiffsDto } from './worktreeDiffDto'

/** The one API the preload script exposes to the renderer as `window.beekeeper`. */
export interface BeekeeperApi {
  /**
   * Lists the project folders under `~/.claude/projects`.
   * @returns The projects, sorted by folder name.
   */
  listProjects(): Promise<IpcResult<readonly ProjectDto[]>>

  /**
   * Lists a project's sessions with their summaries.
   * @param projectDirName - A folder name from {@link BeekeeperApi.listProjects}.
   * @returns The sessions sorted by id, or `not-found` for an unknown project.
   */
  listSessions(projectDirName: string): Promise<IpcResult<readonly SessionListItemDto[]>>

  /**
   * Scans one session in full.
   * @param projectDirName - A folder name from {@link BeekeeperApi.listProjects}.
   * @param sessionId - A session id from {@link BeekeeperApi.listSessions}.
   * @returns The session's detail, or `not-found` when the project or session is gone.
   */
  getSession(projectDirName: string, sessionId: string): Promise<IpcResult<SessionDetailDto>>

  /**
   * Computes what each worktree agent of a session changed, from git.
   * @param projectDirName - A folder name from {@link BeekeeperApi.listProjects}.
   * @param sessionId - A session id from {@link BeekeeperApi.listSessions}.
   * @returns The diffs, with `git` saying whether git was usable, or `not-found` when the project or session is gone.
   */
  getWorktreeDiffs(projectDirName: string, sessionId: string): Promise<IpcResult<WorktreeDiffsDto>>
}
