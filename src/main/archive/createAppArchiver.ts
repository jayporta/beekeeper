import { join } from 'node:path'
import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { IpcDeps } from '../ipc/ipcDeps'
import { listSessionsHandler } from '../ipc/listSessionsHandler'
import { createSessionScanCache } from '../ipc/sessionScanCache'
import { createArchiver, type Archiver } from './createArchiver'
import type { ArchiveStore } from './archiveStoreTypes'
import { hasChangedSessions } from './hasChangedSessions'
import { openArchivableProject } from './openArchivableProject'

/**
 * How many scans the archiver's own scan cache keeps. Each archived session
 * is scanned once, so the cache only needs to hold the scan in flight.
 */
export const ARCHIVER_SCAN_CACHE_CAPACITY = 1

/** Options for {@link createAppArchiver}. */
export interface AppArchiverOptions {
  /** The handlers' dependencies. Their `archive` is replaced by `store` and their `scanCache` by one of the archiver's own. */
  readonly deps: IpcDeps
  /** The archive the sessions are written to. */
  readonly store: ArchiveStore
}

/**
 * Creates the archiver that runs the app's own list handler and detail scan, so
 * its reads share the handlers' caches and schedulers with the UI. A project is
 * listed only when a stat shows a new or changed session, and a detail is
 * scanned only for a session that is pending and quiet for the waiting period.
 * A project's sessions are discovered once for all of its pending details. Its
 * scans go through a scan cache of its own, so archiving doesn't evict the
 * scans the UI has cached.
 *
 * @param options - The handlers' dependencies and the store.
 * @returns The archiver, not yet started.
 */
export function createAppArchiver(options: AppArchiverOptions): Archiver {
  const { store } = options
  const deps: IpcDeps = {
    ...options.deps,
    archive: store,
    scanCache: createSessionScanCache({ capacity: ARCHIVER_SCAN_CACHE_CAPACITY })
  }
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
