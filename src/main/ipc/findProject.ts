import { discoverProjects, type ProjectEntry } from '../../core/transcript/discoverProjects'
import type { SessionEntry } from '../../core/transcript/discoverSessions'

/**
 * Finds a project by exact match in a fresh directory listing, so no path is
 * ever built from a renderer-supplied string.
 * @param projectsRoot - The `~/.claude/projects` directory.
 * @param dirName - A folder name the renderer sent.
 * @returns The listed entry, or `undefined` when no project has that name.
 */
export async function findProject(
  projectsRoot: string,
  dirName: string
): Promise<ProjectEntry | undefined> {
  const projects = await discoverProjects(projectsRoot)
  return projects.find((project) => project.dirName === dirName)
}

/** A session found in a fresh listing, with the project it belongs to. */
export interface FoundSession {
  /** The project entry from the listing. */
  readonly project: ProjectEntry
  /** The session entry from the listing. */
  readonly session: SessionEntry
}
