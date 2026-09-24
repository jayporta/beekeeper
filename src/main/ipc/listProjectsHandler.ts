import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../shared/ipc/projectDto'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'

/**
 * Lists the project folders under the projects root.
 * @param deps - The injected projects root.
 * @returns The projects by folder name, or `[]` when the root doesn't exist.
 */
export async function listProjectsHandler(
  deps: Pick<IpcDeps, 'projectsRoot'>
): Promise<IpcResult<readonly ProjectDto[]>> {
  const projects = await discoverProjects(deps.projectsRoot)
  return okResult(projects.map((project) => ({ dirName: project.dirName })))
}
