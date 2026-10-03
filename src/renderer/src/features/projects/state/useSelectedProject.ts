import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { pickProject } from '../pickProject'
import { useProjects } from '../useProjects'
import { useSelectedProjectStore } from './useSelectedProjectStore'

/**
 * The project in effect: the stored selection when it is still listed,
 * otherwise the first parent project.
 *
 * @returns The project, or `null` while projects are unavailable or when there are none.
 */
export function useSelectedProject(): ProjectDto | null {
  const { data } = useProjects()
  const stored = useSelectedProjectStore((state) => state.selectedDirName)
  if (data === undefined) return null
  const dirName = pickProject(data, stored)
  return data.find((project) => project.dirName === dirName) ?? null
}
