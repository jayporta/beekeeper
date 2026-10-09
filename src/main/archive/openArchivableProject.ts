import { discoverSessions, type SessionEntry } from '../../core/transcript/discoverSessions'
import { findProject } from '../ipc/findProject'
import type { IpcDeps } from '../ipc/ipcDeps'
import { archiveSessionDetail } from '../ipc/archiveSessionDetail'
import { scanSessionDetail } from '../ipc/scanSessionDetail'
import type { ArchivableProject } from './createArchiver'

/** Options for {@link openArchivableProject}. */
export interface OpenArchivableProjectOptions {
  /** The handlers' dependencies, with the archive the details are written to. */
  readonly deps: IpcDeps
  /** The project folder's name. */
  readonly projectDirName: string
}

/**
 * Discovers a project's sessions once, so the archiver can scan any number of
 * its sessions without listing the project again for each, as a request by
 * session id would.
 *
 * @param options - The dependencies and the project.
 * @returns The project's sessions, or `undefined` when the project folder is gone.
 */
export async function openArchivableProject(
  options: OpenArchivableProjectOptions
): Promise<ArchivableProject | undefined> {
  const { deps, projectDirName } = options
  const project = await findProject(deps.projectsRoot, projectDirName)
  if (project === undefined) return undefined
  const sessions = new Map<string, SessionEntry>(
    (await discoverSessions(project.path)).map((session) => [session.sessionId, session])
  )
  return {
    has: (sessionId) => sessions.get(sessionId)?.transcript.ok === true,
    archiveDetail: async (sessionId) => {
      const session = sessions.get(sessionId)
      if (session === undefined || !session.transcript.ok) return
      const transcript = session.transcript.value
      const detail = await scanSessionDetail({
        deps,
        sessionId,
        found: { project, session },
        transcript
      })
      archiveSessionDetail({ deps, projectDirName, detail, transcript })
    }
  }
}
