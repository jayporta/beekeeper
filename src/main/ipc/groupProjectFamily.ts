import { groupTeams } from '../../core/teams/groupTeams'
import { projectFamilyOf } from '../../core/teams/projectFamily'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import type { ArchivedSession } from '../../service/archive/archivePort'
import type { IpcDeps } from './ipcDeps'
import type { ScannedSession } from './mapSessionListItem'
import { mapSessionTeams } from './mapSessionTeams'
import { readArchivedSessions } from './readArchivedSessions'
import { scanProjectSessions, summarizedSessions, type ScanDeps } from './scanProjectSessions'
import { summarizeArchivedSession } from './summarizeArchivedSession'

/** Options for {@link groupProjectFamily}. */
export interface GroupProjectFamilyOptions {
  /** The summary cache, the summaries scheduler, and the archive. */
  readonly deps: ScanDeps & Pick<IpcDeps, 'archive'>
  /** The requested folder, from `projects`. */
  readonly project: ProjectEntry
  /** Every listed project folder. */
  readonly projects: readonly ProjectEntry[]
}

/** A project family's sessions and how each relates to a team. */
export interface ProjectFamilyGrouping {
  /** Every scanned session of the family, folder by folder. */
  readonly scanned: readonly ScannedSession[]
  /**
   * The archived sessions of the family's folders that were scanned, folder by
   * folder: those whose transcripts are no longer on disk. They take part in
   * grouping beside the scanned sessions.
   */
  readonly archived: readonly ArchivedSession[]
  /** Each session's team entry, keyed by `sessionRefKey` of its folder and id. */
  readonly teams: ReadonlyMap<string, SessionTeamDto>
}

/** A family folder's scan: its sessions, or none when the folder could not be read. */
interface FolderScan {
  /** The folder's sessions. */
  readonly sessions: readonly ScannedSession[]
  /** Whether a sibling folder's scan failed, so its live sessions are unknown. */
  readonly failed: boolean
}

/**
 * Scans a sibling family folder, logging a system error by its code and
 * reading the folder as empty so one unreadable folder can't fail the family.
 * Any other error is a bug and is rethrown.
 */
async function scanSiblingFolder(folder: ProjectEntry, deps: ScanDeps): Promise<FolderScan> {
  const scan = await captureSystemError(() => scanProjectSessions({ project: folder }, deps))
  if (scan.ok) return { sessions: scan.value, failed: false }
  console.warn(`Beekeeper skipped a project family folder (${scan.error.code}).`)
  return { sessions: [], failed: true }
}

/** Reads a scanned folder's archived sessions, leaving out the ones that are live. */
function readFolderArchive(
  folder: ProjectEntry,
  scan: FolderScan,
  deps: Pick<IpcDeps, 'archive'>
): readonly ArchivedSession[] {
  // Without the folder's live ids, the archive would hand back copies of live sessions.
  if (scan.failed) return []
  return readArchivedSessions({
    archive: deps.archive,
    projectDirName: folder.dirName,
    liveSessionIds: new Set(scan.sessions.map((session) => session.entry.sessionId))
  })
}

/**
 * Scans every folder of a project's family (its base folder and every listed
 * worktree folder of it) and groups the sessions into teams across them, so
 * grouping never depends on which folder was asked for. Only sessions whose
 * summaries were read take part in grouping, and so do each folder's archived
 * sessions that aren't live there. A sibling family folder whose
 * scan fails with a system error is logged by its code alone and left out,
 * archived sessions too: its teammates count as missing from their lead's
 * team, and a teammate whose lead it held is grouped as if that lead were
 * absent (ungrouped, or under another lead of its team). The requested
 * folder failing to read still throws.
 *
 * @param options - The dependencies, the requested folder, and the listing.
 * @returns The family's scanned and archived sessions and their team entries.
 * @throws {Error} When the requested folder's scan fails, or a sibling folder's
 * scan fails with an error that has no system error code or with one of Node's
 * own `ERR_*` codes, since that is a bug.
 */
export async function groupProjectFamily(
  options: GroupProjectFamilyOptions
): Promise<ProjectFamilyGrouping> {
  const { deps, project, projects } = options
  const familyNames = new Set(
    projectFamilyOf(
      project.dirName,
      projects.map((entry) => entry.dirName)
    )
  )
  const family = projects.filter((entry) => familyNames.has(entry.dirName))
  const scanFolder = async (folder: ProjectEntry): Promise<FolderScan> =>
    folder.dirName === project.dirName
      ? { sessions: await scanProjectSessions({ project: folder }, deps), failed: false }
      : scanSiblingFolder(folder, deps)
  const folders = await Promise.all(
    family.map(async (folder) => ({ folder, scan: await scanFolder(folder) }))
  )
  const scanned = folders.flatMap(({ scan }) => scan.sessions)
  const archived = folders.flatMap(({ folder, scan }) => readFolderArchive(folder, scan, deps))
  const grouped = [
    ...summarizedSessions(scanned),
    ...archived.flatMap((session) => summarizeArchivedSession(session) ?? [])
  ]
  return { scanned, archived, teams: mapSessionTeams(groupTeams(grouped)) }
}
