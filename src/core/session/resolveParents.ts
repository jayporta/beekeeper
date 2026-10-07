import type { AgentId } from '../transcript/ids'
import { findCycleMembers } from './findCycleMembers'
import type { SubagentMetaStatus } from './subagentMetaStatus'

/** One subagent's id and its resolved meta status, as input to {@link resolveParents}. */
export interface ParentLinkInput {
  /** The subagent's id. */
  readonly agentId: AgentId
  /** The subagent's resolved meta status. */
  readonly metaStatus: SubagentMetaStatus
}

/**
 * Keeps only the first occurrence of each agent id, so a repeated id in the
 * input can't add the same child twice under its parent.
 *
 * @param subagents - The session's subagents.
 * @returns The subagents with repeated ids removed, in order.
 */
export function dedupeByAgentId<T extends ParentLinkInput>(subagents: readonly T[]): readonly T[] {
  const seen = new Set<string>()
  const deduped: T[] = []
  for (const subagent of subagents) {
    if (seen.has(subagent.agentId)) continue
    seen.add(subagent.agentId)
    deduped.push(subagent)
  }
  return deduped
}

/**
 * Resolves each subagent's parent from its meta's `parentAgentId`. A parent
 * counts only when it names another subagent in `subagents` and the
 * subagent isn't itself on a cycle of `parentAgentId` links (a self-parent
 * is a cycle). A dangling `parentAgentId`, one on a subagent whose meta
 * didn't resolve, or one on a cycle member leaves the subagent with no
 * parent, meaning the lead. A subagent that merely leads into a cycle it
 * isn't part of keeps its own parent.
 *
 * @param subagents - The session's subagents, each with its resolved meta status.
 * @returns Each subagent's parent, keyed by agent id. A subagent whose
 * parent is the lead has no entry.
 */
export function resolveParents(
  subagents: readonly ParentLinkInput[]
): ReadonlyMap<AgentId, AgentId> {
  const deduped = dedupeByAgentId(subagents)
  const knownById = new Map<string, AgentId>(deduped.map((s) => [s.agentId, s.agentId]))
  const rawParentOf = new Map<AgentId, AgentId>()

  for (const subagent of deduped) {
    if (subagent.metaStatus.status !== 'ok') continue
    const { parentAgentId } = subagent.metaStatus.meta
    const parent = parentAgentId === undefined ? undefined : knownById.get(parentAgentId)
    if (parent !== undefined) rawParentOf.set(subagent.agentId, parent)
  }

  const onCycle = findCycleMembers(rawParentOf)
  const resolved = new Map<AgentId, AgentId>()
  for (const [agentId, parent] of rawParentOf) {
    if (!onCycle.has(agentId)) resolved.set(agentId, parent)
  }
  return resolved
}
