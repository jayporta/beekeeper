import { createServiceDeps } from '../../../service/createServiceDeps'
import { getSession } from '../../../service/sessionDetail/getSession'
import { listSessions } from '../../../service/sessions/listSessions'
import type { PaneServices } from './refreshPane'

/**
 * Builds the service calls a refresh makes, over one set of caches. Build it
 * once per projects folder and keep it, so core's scan caches keep a refresh cheap.
 *
 * @param projectsRoot - The `~/.claude/projects` folder, absolute.
 * @returns The list and get calls.
 */
export function createPaneServices(projectsRoot: string): PaneServices {
  const deps = createServiceDeps(projectsRoot)
  return {
    listSessions: (request) => listSessions(deps, request),
    getSession: (request) => getSession(deps, request)
  }
}
