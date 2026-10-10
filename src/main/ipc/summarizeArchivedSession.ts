import type { SummarizedSession } from '../../core/teams/teamGrouping'
import { toProjectDirName, toSessionId } from '../../core/transcript/ids'
import type { TranscriptTeamSpawns } from '../../core/transcript/teammateSpawn'
import type { ArchivedSession } from '../archive/archiveStoreTypes'

/** The spawns of an archived session saved before they were kept: it claims no teammate. */
const NO_TEAM_SPAWNS: TranscriptTeamSpawns = { spawns: [], stops: [], truncated: false }

/**
 * Takes an archived session as the team grouping takes a live one, from its
 * list item's summary and the team spawns stored beside it. A session with no
 * stored spawns reads as spawning nobody, so an archived teammate still joins
 * its lead and an archived lead claims no teammates.
 *
 * @param session - The archived session.
 * @returns The session with its ref, or `null` when its summary isn't readable.
 */
export function summarizeArchivedSession(session: ArchivedSession): SummarizedSession | null {
  const { item, teamSpawns } = session
  if (!item.summary.ok) return null
  const { role, activity, usage, signals } = item.summary.value
  return {
    ref: {
      projectDirName: toProjectDirName(item.projectDirName),
      sessionId: toSessionId(item.sessionId)
    },
    summary: { role, activity, usage, signals, teamSpawns: teamSpawns ?? NO_TEAM_SPAWNS }
  }
}
