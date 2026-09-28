import { compareByActivityThenRef, pickLead } from './pickLead'
import { spawnPairOrder } from './spawnPairOrder'
import { agentPairKey, foldLabel, foldTeamKey } from './teamKey'
import type {
  LeadGroup,
  SummarizedSession,
  Teammate,
  TeamGrouping,
  UngroupedTeam
} from './teamGrouping'

interface LeadEntry {
  readonly pairOrder: ReadonlyMap<string, number>
  readonly stoppedPairs: ReadonlySet<string>
  readonly spawnJoined: { teammate: Teammate; order: number }[]
  readonly teamJoined: Teammate[]
}

function assertPresent<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message)
  return value
}

/** Appends `value` to the list under `key`, creating the list first when the key is new. */
function appendTo<K, V>(map: Map<K, V[]>, entry: { readonly key: K; readonly value: V }): void {
  const list = map.get(entry.key)
  if (list) list.push(entry.value)
  else map.set(entry.key, [entry.value])
}

/**
 * Indexes each lead session's spawns for the join: the folded (team,
 * name) pairs and folded teams it spawned any member of, each pointing
 * back at the lead, plus that lead's own spawn order and stopped pairs.
 * Every lead gets an entry, even one with no spawns.
 */
function indexLeads(leadSessions: readonly SummarizedSession[]): {
  readonly entries: Map<SummarizedSession, LeadEntry>
  readonly pairCandidates: Map<string, SummarizedSession[]>
  readonly teamCandidates: Map<string, SummarizedSession[]>
} {
  const entries = new Map<SummarizedSession, LeadEntry>()
  const pairCandidates = new Map<string, SummarizedSession[]>()
  const teamCandidates = new Map<string, SummarizedSession[]>()

  for (const lead of leadSessions) {
    const pairOrder = spawnPairOrder(lead.summary.teamSpawns.spawns)
    const teamsSeen = new Set<string>()
    for (const spawn of lead.summary.teamSpawns.spawns) {
      if (spawn.teamName !== null) teamsSeen.add(foldLabel(spawn.teamName))
    }
    const stoppedPairs = new Set<string>()
    for (const stop of lead.summary.teamSpawns.stops) {
      if (stop.teamName !== null) stoppedPairs.add(foldTeamKey(stop.teamName, stop.agentName))
    }
    entries.set(lead, { pairOrder, stoppedPairs, spawnJoined: [], teamJoined: [] })
    for (const pairKey of pairOrder.keys()) appendTo(pairCandidates, { key: pairKey, value: lead })
    for (const teamKey of teamsSeen) appendTo(teamCandidates, { key: teamKey, value: lead })
  }

  return { entries, pairCandidates, teamCandidates }
}

/** The lead a folded pair or team key's spawn pool resolves to, or `null` when nothing spawned it. */
function resolveLead(options: {
  readonly candidates: ReadonlyMap<string, SummarizedSession[]>
  readonly key: string | null
  readonly teammateStartMs: number | null
}): SummarizedSession | null {
  const { candidates, key, teammateStartMs } = options
  if (key === null) return null
  const pool = candidates.get(key)
  return pool === undefined ? null : pickLead(pool, teammateStartMs)
}

/** An ungrouped team's own display spelling, or `null` for a session with no usable team. */
function agentTeamName(session: SummarizedSession): string | null {
  const role = session.summary.role
  return role.kind === 'agent' ? role.teamName : null
}

/**
 * Joins a collection of session summaries into teams: every agent session
 * under the lead session that spawned it, matched by folded (team, name)
 * pair first and by folded team alone when no lead claims the pair, with
 * sessions no lead claims left ungrouped. See {@link TeamGrouping}.
 *
 * @param sessions - Every session summary to join, in no particular order.
 * @returns The grouping.
 */
export function groupTeams(sessions: readonly SummarizedSession[]): TeamGrouping {
  const leadSessions = sessions.filter((session) => session.summary.role.kind === 'lead')
  const { entries, pairCandidates, teamCandidates } = indexLeads(leadSessions)
  const ungroupedByTeam = new Map<string | null, SummarizedSession[]>()

  for (const session of sessions) {
    const role = session.summary.role
    if (role.kind !== 'agent') continue

    const { teamName } = role
    const pairKey = agentPairKey(role)
    const teamKey = teamName !== null ? foldLabel(teamName) : null
    const teammateStartMs = session.summary.activity?.earliestMs ?? null

    const spawnLead = resolveLead({ candidates: pairCandidates, key: pairKey, teammateStartMs })
    const lead =
      spawnLead ?? resolveLead({ candidates: teamCandidates, key: teamKey, teammateStartMs })

    if (lead === null) {
      appendTo(ungroupedByTeam, { key: teamKey, value: session })
      continue
    }

    const joinedBy = spawnLead !== null ? 'spawn' : 'team'
    const entry = assertPresent(entries.get(lead), 'chosen lead was not indexed')
    const stopped = pairKey !== null && entry.stoppedPairs.has(pairKey)
    const teammate: Teammate = { session, joinedBy, stopped }
    if (joinedBy === 'spawn') {
      const key = assertPresent(pairKey, 'a spawn join always has a pair key')
      const order = assertPresent(entry.pairOrder.get(key), 'spawn-joined pair missing its order')
      entry.spawnJoined.push({ teammate, order })
    } else {
      entry.teamJoined.push(teammate)
    }
  }

  const leads: LeadGroup[] = leadSessions
    .map((lead) => {
      const entry = assertPresent(entries.get(lead), 'lead missing its index entry')
      const spawnJoined = entry.spawnJoined
        .sort(
          (a, b) =>
            a.order - b.order || compareByActivityThenRef(a.teammate.session, b.teammate.session)
        )
        .map((p) => p.teammate)
      const teamJoined = entry.teamJoined.sort((a, b) =>
        compareByActivityThenRef(a.session, b.session)
      )
      return { lead, teammates: [...spawnJoined, ...teamJoined] }
    })
    .sort((a, b) => compareByActivityThenRef(a.lead, b.lead))

  const ungrouped: UngroupedTeam[] = [...ungroupedByTeam.values()]
    .map((members) => {
      members.sort(compareByActivityThenRef)
      const first = assertPresent(members[0], 'an ungrouped team has no members')
      return { teamName: agentTeamName(first), first, members }
    })
    .sort((a, b) => compareByActivityThenRef(a.first, b.first))
    .map(({ teamName, members }) => ({ teamName, members }))

  return { leads, ungrouped }
}
