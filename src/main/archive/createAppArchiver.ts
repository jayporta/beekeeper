import { join } from 'node:path'
import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { IpcDeps } from '../ipc/ipcDeps'
import { listSessionsHandler } from '../ipc/listSessionsHandler'
import { createArchiver, type Archiver } from './createArchiver'
import type { ArchiveStore } from './archiveStoreTypes'
import { hasChangedSessions } from './hasChangedSessions'
import { openArchivableProject } from './openArchivableProject'

/** Options for {@link createAppArchiver}. */
export interface AppArchiverOptions {
  /** The handlers' dependencies. Their `archive` is replaced by `store`. */
  readonly deps: IpcDeps
  /** The archive the sessions are written to. */
  readonly store: ArchiveStore
}

/**
 * Creates the archiver that runs the app's own list handler and detail scan, so
 * its reads share the handlers' caches and schedulers with the UI. A project is
 * listed only when a stat shows a new or changed session, and a detail is
 * scanned only for a session that is pending and quiet for the waiting period.
 * A project's sessions are discovered once for all of its pending details.
 *
 * @param options - The handlers' dependencies and the store.
 * @returns The archiver, not yet started.
 */
export function createAppArchiver(options: AppArchiverOptions): Archiver {
  const { store } = options
  const deps: IpcDeps = { ...options.deps, archive: store }
  return createArchiver({
    listProjects: async () => (await discoverProjects(deps.projectsRoot)).map((p) => p.dirName),
    changedSessions: (projectDirName) =>
      hasChangedSessions({
        projectDirName,
        projectPath: join(deps.projectsRoot, projectDirName),
        store
      }),
    listSessions: async (projectDirName) => {
      await listSessionsHandler(deps, { projectDirName })
    },
    pendingDetails: () => store.pendingDetails(),
    openProject: (projectDirName) => openArchivableProject({ deps, projectDirName }),
    skipDetail: (ref) => store.skipDetail(ref),
    now: deps.now
  })
}
