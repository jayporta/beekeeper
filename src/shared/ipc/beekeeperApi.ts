import type { FilesChangedDto } from './filesChangedDto'
import type { IpcResult } from './ipcResult'
import type { OtelReceiverDto } from './otelReceiverDto'
import type { ProjectDto } from './projectDto'
import type { ProjectDailyUsageDto } from './projectDailyUsageDto'
import type { ProjectTotalsDto, TotalsWindowDto } from './projectTotalsDto'
import type { ReportedCostDto } from './reportedCostDto'
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
   * Adds up one project folder's own tokens by local day and model over a window.
   * Each message counts on the day it ran, so only the messages inside the window count.
   * @param projectDirName - A folder name from {@link BeekeeperApi.listProjects}.
   * @param window - How far back to count: `7d` or `30d`.
   * @returns The folder's usage for every day of the window, or `not-found` for an unknown project. A worktree folder is its own project here.
   */
  getProjectDailyUsage(
    projectDirName: string,
    window: TotalsWindowDto
  ): Promise<IpcResult<ProjectDailyUsageDto>>

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

  /**
   * Reads the opt-in telemetry receiver, which listens on 127.0.0.1 for Claude Code's own cost reports.
   * @returns Whether it is turned on, whether it is listening, the port to export to, and, while it is on, the bearer token Claude Code must send.
   */
  getOtelReceiver(): Promise<IpcResult<OtelReceiverDto>>

  /**
   * Turns the telemetry receiver on or off. Turning it on saves the choice, creates the token the first time, and starts listening.
   * @param enabled - Whether the receiver should run.
   * @returns The receiver afterwards. A receiver that couldn't start comes back `failed` with the reason, and stays turned on.
   */
  setOtelReceiverEnabled(enabled: boolean): Promise<IpcResult<OtelReceiverDto>>

  /**
   * Reads what Claude Code's telemetry reported for one session since beekeeper started listening.
   * @param sessionId - A session id from {@link BeekeeperApi.listSessions}.
   * @returns Claude Code's own cost estimate and token totals, or `null` when the session reported nothing.
   */
  getReportedCost(sessionId: string): Promise<IpcResult<ReportedCostDto | null>>

  /**
   * Copies text to the system clipboard. The renderer's own clipboard access is denied, so the main process writes it.
   * @param text - The text to copy, at most 4096 characters.
   * @returns `null` once copied, `invalid-request` for text over the cap, or `internal` when the app has no clipboard writer.
   */
  copyText(text: string): Promise<IpcResult<null>>

  /**
   * Subscribes to the menu's request to open the About dialog.
   * @param listener - Called with no arguments each time About is chosen from the menu.
   * @returns A function that removes the subscription.
   */
  onOpenAbout(listener: () => void): () => void

  /**
   * Subscribes to changes under `~/.claude/projects`, which the main process sends in batches.
   * @param listener - Called with each batch that passes validation. Invalid payloads are dropped.
   * @returns A function that removes this subscription and no other.
   */
  onFilesChanged(listener: (change: FilesChangedDto) => void): () => void

  /**
   * Subscribes to the notice that live updates stopped and won't resume.
   * @param listener - Called with no arguments. A notice sent before anyone subscribed is delivered once, to the first subscriber.
   * @returns A function that removes this subscription and no other.
   */
  onLiveUpdatesUnavailable(listener: () => void): () => void
}
