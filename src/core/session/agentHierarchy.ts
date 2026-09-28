import type { AgentId } from '../transcript/ids'
import { dedupeByAgentId, resolveParents, type ParentLinkInput } from './resolveParents'

/**
 * A session's subagents deduped by id, alongside each one's resolved parent.
 * @typeParam T - The subagent input type, at least a {@link ParentLinkInput}.
 */
export interface AgentHierarchy<T extends ParentLinkInput> {
  /** The subagents with repeated ids removed, in order. */
  readonly subagents: readonly T[]
  /**
   * Each subagent's parent, keyed by agent id. A subagent whose parent is
   * the lead has no entry.
   */
  readonly parentOf: ReadonlyMap<AgentId, AgentId>
}

/**
 * Resolves a session's agent hierarchy once, so every consumer that needs
 * the deduped subagent list and the parent map works from the same pair
 * instead of each recomputing it. Parents follow {@link resolveParents}'
 * rules, so a dangling link or a cycle member has no entry.
 *
 * @param subagents - The session's subagents, each with its resolved meta status.
 * @returns The subagents deduped by id, and each one's resolved parent.
 */
export function resolveAgentHierarchy<T extends ParentLinkInput>(
  subagents: readonly T[]
): AgentHierarchy<T> {
  const deduped = dedupeByAgentId(subagents)
  return { subagents: deduped, parentOf: resolveParents(deduped) }
}
