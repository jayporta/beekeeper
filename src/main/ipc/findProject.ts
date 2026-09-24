import { discoverProjects, type ProjectEntry } from '../../core/transcript/discoverProjects'
import { discoverSessions, type SessionEntry } from '../../core/transcript/discoverSessions'

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

/** Options for {@link findSession}. */
export interface FindSessionOptions {
  /** The `~/.claude/projects` directory. */
  readonly projectsRoot: string
  /** A project folder name the renderer sent. */
  readonly dirName: string
  /** A session id the renderer sent. */
  readonly sessionId: string
}

/**
 * Finds a session by exact match in fresh listings of the projects and the
 * project's sessions.
 * @param options - The projects root and the renderer's names.
 * @returns The listed project and session, or `undefined` when either is gone.
 */
export async function findSession(options: FindSessionOptions): Promise<FoundSession | undefined> {
  const project = await findProject(options.projectsRoot, options.dirName)
  if (project === undefined) return undefined
  const sessions = await discoverSessions(project.path)
  const session = sessions.find((entry) => entry.sessionId === options.sessionId)
  return session === undefined ? undefined : { project, session }
}
