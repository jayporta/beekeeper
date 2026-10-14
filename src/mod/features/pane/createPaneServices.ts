import { createServiceDeps } from '../../../service/createServiceDeps'
import { getSession } from '../../../service/sessionDetail/getSession'
import { listProjects } from '../../../service/projects/listProjects'
import { listSessions } from '../../../service/sessions/listSessions'
import { getWorktreeDiffs } from '../../../service/worktrees/getWorktreeDiffs'
import { getWorktreePatch } from '../../../service/worktrees/getWorktreePatch'
import type { PaneServices } from '../shared/paneServices'

/**
 * Builds the service calls a refresh makes, over one set of caches. Build it
 * once per projects folder and keep it, so core's scan caches keep a refresh cheap.
 *
 * @param projectsRoot - The `~/.claude/projects` folder, absolute.
 * @returns The list, get, project, worktree diff and worktree patch calls.
 */
export function createPaneServices(projectsRoot: string): PaneServices {
  const deps = createServiceDeps(projectsRoot)
  return {
    listSessions: (request) => listSessions(deps, request),
    getSession: (request) => getSession(deps, request),
    listProjects: () => listProjects(deps),
    getWorktreeDiffs: (request) => getWorktreeDiffs(deps, request),
    getWorktreePatch: (request) => getWorktreePatch(deps, request)
  }
}
