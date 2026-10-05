import type { IpcResult } from './ipcResult'
import type { ProjectDto } from './projectDto'
import type { ProjectTotalsDto, TotalsWindowDto } from './projectTotalsDto'
import type { SessionDetailDto } from './sessionDetailDto'
import type { SessionListItemDto } from './sessionListDto'
import type { WorktreeDiffsDto } from './worktreeDiffDto'
import type { WorktreePatchDto } from './worktreePatchDto'

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

  /**
   * Adds up one project folder's own sessions over a window, from the summaries it reads.
   * @param projectDirName - A folder name from {@link BeekeeperApi.listProjects}.
   * @param window - How far back to count: `7d` or `30d`.
   * @returns The folder's totals, or `not-found` for an unknown project. A worktree folder is its own project here, so a project with worktrees sums them.
   */
  getProjectTotals(
    projectDirName: string,
    window: TotalsWindowDto
  ): Promise<IpcResult<ProjectTotalsDto>>

  /**
   * Reads the patch of what one worktree agent changed, from git. Read-only.
   * @param projectDirName - A folder name from {@link BeekeeperApi.listProjects}.
   * @param sessionId - A session id from {@link BeekeeperApi.listSessions}.
   * @param agentId - The id of a subagent in that session whose meta names a worktree branch.
   * @returns The patches, or why git can't give them, or `not-found` when the project, session, or agent is gone or names no worktree branch.
   */
  getWorktreePatch(
    projectDirName: string,
    sessionId: string,
    agentId: string
  ): Promise<IpcResult<WorktreePatchDto>>
}
