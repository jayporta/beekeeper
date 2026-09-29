import { groupTeams } from '../../core/teams/groupTeams'
import { projectFamilyOf } from '../../core/teams/projectFamily'
import type { ProjectEntry } from '../../core/transcript/discoverProjects'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { describeError } from '../startupFailure'
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
 * Scans every folder of a project's family (its base folder and every listed
 * worktree folder of it) and groups the sessions into teams across them, so
 * grouping never depends on which folder was asked for. Only sessions whose
 * summaries were read take part in grouping. A sibling family folder whose
 * scan fails is logged and left out: its teammates count as missing from
 * their lead's team, and a teammate whose lead it held is grouped as if that
 * lead were absent (ungrouped, or under another lead of its team). The
 * requested folder failing to read still throws.
 *
 * @param options - The dependencies, the requested folder, and the listing.
 * @returns The family's scanned sessions and their team entries.
 */
export async function groupProjectFamily(
  options: GroupProjectFamilyOptions
): Promise<ProjectFamilyGrouping> {
  const { deps, project, projects } = options
  const familyNames = projectFamilyOf(
    project.dirName,
    projects.map((entry) => entry.dirName)
  )
  const family = projects.filter((entry) => familyNames.includes(entry.dirName))
  const scanned = (
    await Promise.all(
      family.map((folder) =>
        folder.dirName === project.dirName
          ? scanProjectSessions(folder, deps)
          : scanProjectSessions(folder, deps).catch((error: unknown): ScannedSession[] => {
              console.warn(`Beekeeper skipped a project family folder (${describeError(error)}).`)
              return []
            })
      )
    )
  ).flat()
  return { scanned, teams: mapSessionTeams(groupTeams(summarizedSessions(scanned))) }
}
