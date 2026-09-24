import type { AgentId } from '../transcript/ids'
import type { AgentTreeInput } from './agentTree'
import { dedupeByAgentId, resolveParents } from './resolveParents'
import type { SpawnContext } from './spawnContext'
import type { BranchSighting, TranscriptSpawns } from './spawnObserver'

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
 * match is exact. Otherwise the context is inferred from the last named
 * branch, and the cwd of its record, in the parent's transcript, then each
 * further ancestor's, then the lead's. An ancestor with no readable
 * transcript contributes nothing. A subagent none of these reach is left
 * out.
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

  const nearestBranch = (agent: AgentTreeInput): BranchSighting | undefined => {
    let current = parentOf.get(agent.agentId)
    while (current !== undefined) {
      const sighting = transcriptOf(current)?.lastBranch
      if (sighting !== undefined) return sighting
      current = parentOf.get(current)
    }
    return leadTranscript.lastBranch
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
    const nearest = nearestBranch(agent)
    if (nearest !== undefined) {
      contexts.set(agent.agentId, { cwd: nearest.cwd, baseBranch: nearest.branch, inferred: true })
    }
  }
  return contexts
}
