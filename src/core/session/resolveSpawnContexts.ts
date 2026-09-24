import type { AgentId } from '../transcript/ids'
import type { AgentTreeInput } from './agentTree'
import { dedupeByAgentId, resolveParents } from './resolveParents'
import type { SpawnContext } from './spawnContext'
import { pickSighting, type PickedLocation } from './pickSighting'
import type { TranscriptSpawns } from './spawnObserver'

/** The most ancestors walked for one subagent before falling back to the lead. */
export const MAX_ANCESTOR_DEPTH = 64

/** Input for {@link resolveSpawnContexts}. */
export interface ResolveSpawnContextsInput {
  /** The session's subagents with their resolved meta status. */
  readonly subagents: readonly AgentTreeInput[]
  /** What the lead's transcript showed. */
  readonly leadTranscript: TranscriptSpawns
  /** What each successfully read subagent transcript showed. Unreadable ones are absent. */
  readonly subagentTranscripts: ReadonlyMap<AgentId, TranscriptSpawns>
}

/**
 * Resolves where each subagent was spawned from.
 *
 * A subagent's `toolUseId` is looked up only in its parent's transcript: the
 * transcript of the subagent named by `parentAgentId`, or the lead's when
 * there is none. Parents are the ones `buildAgentTree` uses, so a dangling
 * link or a cycle member (including a self-parent) has the lead as parent. A
 * match is exact. Otherwise the context is inferred from the branch and cwd
 * the parent's transcript showed when the subagent started: the last
 * timeline entry in file order at or before the subagent's own start time,
 * then each further ancestor's, then the lead's, every level using the
 * subagent's start. A `HEAD` entry borrows the nearest earlier named branch
 * in the same cwd that was also seen at or before the start. Entries with no
 * timestamp are skipped when the start is known. An ancestor with no
 * readable transcript, or no entry at or before the start, contributes
 * nothing. When the subagent's own
 * transcript is unreadable or has no timestamps, the latest entry is used
 * instead, still flagged inferred. The walk visits at most
 * {@link MAX_ANCESTOR_DEPTH} ancestors, then goes straight to the lead. A
 * subagent none of these reach is left out.
 *
 * @param input - The subagents and each transcript's observed spawns.
 * @returns The context of each subagent that resolved one.
 */
export function resolveSpawnContexts(
  input: ResolveSpawnContextsInput
): ReadonlyMap<AgentId, SpawnContext> {
  const { subagents, leadTranscript, subagentTranscripts } = input
  const parentOf = resolveParents(subagents)

  const transcriptOf = (agentId: AgentId | undefined): TranscriptSpawns | undefined =>
    agentId === undefined ? leadTranscript : subagentTranscripts.get(agentId)

  const nearestLocation = (agent: AgentTreeInput): PickedLocation | undefined => {
    const startedAt = subagentTranscripts.get(agent.agentId)?.startedAt
    let current = parentOf.get(agent.agentId)
    for (let depth = 0; current !== undefined && depth < MAX_ANCESTOR_DEPTH; depth++) {
      const timeline = transcriptOf(current)?.timeline
      const picked = timeline === undefined ? undefined : pickSighting(timeline, startedAt)
      if (picked !== undefined) return picked
      current = parentOf.get(current)
    }
    return pickSighting(leadTranscript.timeline, startedAt)
  }

  const contexts = new Map<AgentId, SpawnContext>()
  for (const agent of dedupeByAgentId(subagents)) {
    const toolUseId = agent.metaStatus.status === 'ok' ? agent.metaStatus.meta.toolUseId : undefined
    const exact =
      toolUseId === undefined
        ? undefined
        : transcriptOf(parentOf.get(agent.agentId))?.spawns.get(toolUseId)
    if (exact !== undefined) {
      contexts.set(agent.agentId, { ...exact, inferred: false })
      continue
    }
    const nearest = nearestLocation(agent)
    if (nearest !== undefined) contexts.set(agent.agentId, { ...nearest, inferred: true })
  }
  return contexts
}
