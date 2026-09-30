import { discoverProjects } from '../../core/transcript/discoverProjects'
import { worktreeParentOf } from '../../core/teams/projectFamily'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../shared/ipc/projectDto'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'

/**
 * Lists the project folders under the projects root, each marked with the
 * listed folder it is a worktree of, if any.
 * @param deps - The injected projects root.
 * @returns The projects by folder name, or `[]` when the root doesn't exist.
 */
export async function listProjectsHandler(
  deps: Pick<IpcDeps, 'projectsRoot'>
): Promise<IpcResult<readonly ProjectDto[]>> {
  const projects = await discoverProjects(deps.projectsRoot)
  const listed = new Set(projects.map((project) => project.dirName))
  return okResult(
    projects.map((project) => ({
      dirName: project.dirName,
      worktreeOf: worktreeParentOf(project.dirName, listed)
    }))
  )
}
