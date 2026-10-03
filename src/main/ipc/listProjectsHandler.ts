import { discoverProjects } from '../../core/transcript/discoverProjects'
import { worktreeNameOf, worktreeParentOf } from '../../core/teams/projectFamily'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../shared/ipc/projectDto'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'

/**
 * Lists the project folders under the projects root, each with a label read
 * from one of its first few transcripts, and with the listed folder it is a
 * worktree of and its worktree name, if any.
 * @param deps - The injected projects root and project label cache.
 * @returns The projects by folder name, or `[]` when the root doesn't exist.
 */
export async function listProjectsHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'projectLabels'>
): Promise<IpcResult<readonly ProjectDto[]>> {
  const projects = await discoverProjects(deps.projectsRoot)
  const listed = new Set(projects.map((project) => project.dirName))
  const labels = await deps.projectLabels.labelsFor(projects)
  return okResult(
    projects.map((project) => ({
      dirName: project.dirName,
      label: labels.get(project.dirName) ?? null,
      worktreeOf: worktreeParentOf(project.dirName, listed),
      worktreeName: worktreeNameOf(project.dirName, listed)
    }))
  )
}
