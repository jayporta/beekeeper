import { pickProject } from '../pickProject'
import { useProjects } from '../useProjects'
import { useSelectedProjectStore } from './useSelectedProjectStore'

/**
 * The folder name of the project in effect: the stored selection when it is
 * still listed, otherwise the first parent project.
 *
 * @returns The folder name, or `null` while projects are unavailable or when there are none.
 */
export function useSelectedProjectDirName(): string | null {
  const { data } = useProjects()
  const stored = useSelectedProjectStore((state) => state.selectedDirName)
  return data === undefined ? null : pickProject(data, stored)
}
