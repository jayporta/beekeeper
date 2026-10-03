import { useSelectedProject } from './useSelectedProject'

/**
 * The folder name of the project in effect: the stored selection when it is
 * still listed, otherwise the first parent project.
 *
 * @returns The folder name, or `null` while projects are unavailable or when there are none.
 */
export function useSelectedProjectDirName(): string | null {
  return useSelectedProject()?.dirName ?? null
}
