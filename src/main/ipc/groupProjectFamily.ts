import { groupTeams } from '../../core/teams/groupTeams'
import { projectFamilyOf } from '../../core/teams/projectFamily'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import type { IpcDeps } from './ipcDeps'
import type { ScannedSession } from './mapSessionListItem'
import { mapSessionTeams } from './mapSessionTeams'
import { scanProjectSessions, summarizedSessions } from './scanProjectSessions'

/** Options for {@link groupProjectFamily}. */
export interface GroupProjectFamilyOptions {
  /** The summary cache and the summaries scheduler. */
  readonly deps: Pick<IpcDeps, 'summaryCache' | 'summaries'>
  /** The requested folder, from `projects`. */
  readonly project: ProjectEntry
  /** Every listed project folder. */
  readonly projects: readonly ProjectEntry[]
}

/** A project family's sessions and how each relates to a team. */
export interface ProjectFamilyGrouping {
  /** Every scanned session of the family, folder by folder. */
  readonly scanned: readonly ScannedSession[]
  /** Each session's team entry, keyed by `sessionRefKey` of its folder and id. */
  readonly teams: ReadonlyMap<string, SessionTeamDto>
}

/**
 * Scans a sibling family folder, logging a system error by its code and
 * reading the folder as empty so one unreadable folder can't fail the family.
 * Any other error is a bug and is rethrown.
 */
async function scanSiblingFolder(
  folder: ProjectEntry,
  deps: GroupProjectFamilyOptions['deps']
): Promise<readonly ScannedSession[]> {
  const scan = await captureSystemError(() => scanProjectSessions({ project: folder }, deps))
  if (scan.ok) return scan.value
  console.warn(`Beekeeper skipped a project family folder (${scan.error.code}).`)
  return []
}

/**
 * Scans every folder of a project's family (its base folder and every listed
 * worktree folder of it) and groups the sessions into teams across them, so
 * grouping never depends on which folder was asked for. Only sessions whose
 * summaries were read take part in grouping. A sibling family folder whose
 * scan fails with a system error is logged by its code alone and left out: its
 * teammates count as missing from their lead's team, and a teammate whose lead
 * it held is grouped as if that lead were absent (ungrouped, or under another
 * lead of its team). The requested folder failing to read still throws.
 *
 * @param options - The dependencies, the requested folder, and the listing.
 * @returns The family's scanned sessions and their team entries.
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
  const scanned = (
    await Promise.all(
      family.map((folder) =>
        folder.dirName === project.dirName
          ? scanProjectSessions({ project: folder }, deps)
          : scanSiblingFolder(folder, deps)
      )
    )
  ).flat()
  return { scanned, teams: mapSessionTeams(groupTeams(summarizedSessions(scanned))) }
}
