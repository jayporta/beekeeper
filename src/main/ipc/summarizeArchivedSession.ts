import type { SummarizedSession } from '../../core/teams/teamGrouping'
import { toProjectDirName, toSessionId } from '../../core/transcript/ids'
import type { TranscriptTeamSpawns } from '../../core/transcript/teammateSpawn'
import type { ArchivedSession } from '../../service/archive/archivePort'

/** The spawns of a transcript that spawned and stopped nobody, and of an archived session saved before they were kept. */
export const NO_TEAM_SPAWNS: TranscriptTeamSpawns = { spawns: [], stops: [], truncated: false }

/**
 * What was built for each archived session. The archive hands back the same
 * object for a row until the row changes, so a list refreshed every few
 * seconds builds each one once.
 */
const summarized = new WeakMap<ArchivedSession, SummarizedSession | null>()

/**
 * Takes an archived session as the team grouping takes a live one, from its
 * list item's summary and the team spawns stored beside it. A session with no
 * stored spawns reads as spawning nobody, so an archived teammate still joins
 * its lead and an archived lead claims no teammates. The result is kept for
 * as long as the same session object is in use.
 *
 * @param session - The archived session.
 * @returns The session with its ref, or `null` when its summary isn't readable.
 */
export function summarizeArchivedSession(session: ArchivedSession): SummarizedSession | null {
  const known = summarized.get(session)
  if (known !== undefined) return known
  const built = build(session)
  summarized.set(session, built)
  return built
}

function build({ item, teamSpawns }: ArchivedSession): SummarizedSession | null {
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
