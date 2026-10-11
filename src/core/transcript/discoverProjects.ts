import { fileSystem } from '../io/installFileSystem'
import { compareCodeUnits } from '../shared/compareCodeUnits'
import { toProjectDirName, type ProjectDirName } from './ids'
import { readDirentsOrEmpty } from './readDirentsOrEmpty'

/** One project folder found directly under `~/.claude/projects`. */
export interface ProjectEntry {
  /** The folder's name exactly as it appears on disk, never decoded. */
  readonly dirName: ProjectDirName
  /** The folder's absolute path. */
  readonly path: string
}

/**
 * Lists the project folders directly under a `projects` directory.
 *
 * Only real directories are returned: the port's `readDir`
 * reports a symlink as `symlink`, never following it, so one at the top level
 * is skipped rather than resolved. Folder
 * names are never decoded back into a filesystem path.
 *
 * @param projectsDir - The `projects` directory itself; the caller resolves
 * where it lives. A relative path is resolved against the working directory.
 * @returns Project entries sorted by folder name, or `[]` when `projectsDir`
 * does not exist.
 * @throws {Error} When `projectsDir` cannot be read for a reason other than
 * being missing.
 */
export async function discoverProjects(projectsDir: string): Promise<ProjectEntry[]> {
  const fs = fileSystem()
  const root = fs.resolvePath(projectsDir)
  const dirents = await readDirentsOrEmpty(root)

  const entries = dirents
    .filter((dirent) => dirent.kind === 'directory')
    .map((dirent): ProjectEntry => ({
      dirName: toProjectDirName(dirent.name),
      path: fs.joinPath(root, dirent.name)
    }))

  entries.sort((a, b) => compareCodeUnits(a.dirName, b.dirName))
  return entries
}
