import { compareCodeUnits } from '../transcript/compareCodeUnits'
import type { AgentId } from '../transcript/ids'
import {
  agentIdentityKey,
  leadIdentity,
  subagentIdentity,
  type AgentIdentity
} from './agentIdentity'
import { dedupeByAgentId, resolveParents, type ParentLinkInput } from './resolveParents'
import type { SubagentMetaStatus } from './subagentMetaStatus'

/** One subagent's id and its resolved meta status, as input to {@link buildAgentTree}. */
export type AgentTreeInput = ParentLinkInput

/** One node in a session's agent tree: the lead, a subagent, or a teammate. */
export interface AgentTreeNode {
  /** Which agent this node represents. */
  readonly identity: AgentIdentity
  /** The node's meta status: `absent` for the lead, which never has one. */
  readonly metaStatus: SubagentMetaStatus
  /** Whether this agent was spawned into a team, per its meta's `teamName`. */
  readonly isTeammate: boolean
  /** This node's direct children, ordered by agent id. */
  readonly children: readonly AgentTreeNode[]
}

/** Lookup context threaded through {@link buildTree}. */
interface TreeContext {
  readonly inputByAgentId: ReadonlyMap<string, AgentTreeInput>
  readonly childIdsByParentKey: ReadonlyMap<string, readonly AgentId[]>
}

/** {@link TreeContext} plus every node {@link buildTree} has assembled so far. */
interface NodeBuildContext extends TreeContext {
  readonly builtByKey: ReadonlyMap<string, AgentTreeNode>
}

/**
 * Builds a session's agent tree from its subagents, with the lead as root.
 *
 * A subagent's parent is its meta's `parentAgentId` when that names another
 * subagent in `subagents` and that subagent isn't itself on a cycle of raw
 * `parentAgentId` links. A dangling `parentAgentId` (naming no subagent
 * here), one on a subagent whose meta didn't resolve, or one on a subagent
 * that's part of a cycle all fall back to the lead; a subagent that merely
 * leads into a cycle it isn't part of (`c -> a -> b -> a`) keeps its own
 * raw parent. A subagent counts as a teammate when its meta carries a
 * `teamName`, since a teammate's meta doesn't always carry `toolUseId`
 * either, and neither does every non-team meta. Children at each level are
 * ordered by agent id. A repeated agent id in `subagents` keeps only its
 * first occurrence; later ones are ignored rather than added as a second
 * child under the same parent.
 *
 * Cycle detection and tree construction both run iteratively, in time
 * proportional to the number of subagents, so neither a long chain of
 * `parentAgentId` links nor a deep resulting tree costs quadratic time or
 * risks a stack overflow.
 *
 * @param subagents - The session's subagents, each with its resolved meta status.
 * @returns The lead node, with every subagent nested somewhere beneath it.
 */
export function buildAgentTree(subagents: readonly AgentTreeInput[]): AgentTreeNode {
  const deduped = dedupeByAgentId(subagents)
  const inputByAgentId = new Map<string, AgentTreeInput>(deduped.map((s) => [s.agentId, s]))
  const parentOf = resolveParents(deduped)

  const childIdsByParentKey = new Map<string, AgentId[]>()
  for (const subagent of deduped) {
    const parent = parentOf.get(subagent.agentId)
    const parentKey = agentIdentityKey(
      parent === undefined ? leadIdentity : subagentIdentity(parent)
    )
    const group = childIdsByParentKey.get(parentKey)
    if (group) group.push(subagent.agentId)
    else childIdsByParentKey.set(parentKey, [subagent.agentId])
  }
  for (const group of childIdsByParentKey.values()) group.sort(compareCodeUnits)

  return buildTree({ inputByAgentId, childIdsByParentKey })
}

/**
 * Builds every tree node iteratively: a first pass walks down from the
 * lead with an explicit stack to record visiting order (so every node is
 * recorded before its own children are), then a second pass builds nodes
 * in reverse of that order, so each node's children are already built by
 * the time it's assembled. Recursion would do the same in one pass, but a
 * chain of subagents thousands deep would overflow the call stack.
 *
 * @param context - Lookup maps shared across the whole build.
 * @returns The fully built lead node, with every subagent nested beneath it.
 * @throws {Error} When the lead node was somehow never built, which would
 * indicate a bug in the traversal above rather than anything about the input.
 */
function buildTree(context: TreeContext): AgentTreeNode {
  const visitOrder: AgentIdentity[] = []
  const pending: AgentIdentity[] = [leadIdentity]

  while (pending.length > 0) {
    const identity = pending.pop()
    if (identity === undefined) continue

    visitOrder.push(identity)
    for (const childId of context.childIdsByParentKey.get(agentIdentityKey(identity)) ?? []) {
      pending.push(subagentIdentity(childId))
    }
  }

  const builtByKey = new Map<string, AgentTreeNode>()
  const buildContext: NodeBuildContext = { ...context, builtByKey }
  for (let i = visitOrder.length - 1; i >= 0; i -= 1) {
    const identity = visitOrder[i]
    if (identity === undefined) continue
    builtByKey.set(agentIdentityKey(identity), buildNode(identity, buildContext))
  }

  const leadNode = builtByKey.get(agentIdentityKey(leadIdentity))
  if (leadNode === undefined) throw new Error('Agent tree build produced no lead node')
  return leadNode
}

/**
 * Assembles one node from already-built children.
 * @param identity - The node's identity.
 * @param context - Lookup maps shared across the whole build, including
 * every node built so far; this node's children are guaranteed to already
 * be in `context.builtByKey`.
 * @returns The assembled node.
 */
function buildNode(identity: AgentIdentity, context: NodeBuildContext): AgentTreeNode {
  const metaStatus: SubagentMetaStatus =
    identity.kind === 'subagent'
      ? (context.inputByAgentId.get(identity.agentId)?.metaStatus ?? { status: 'absent' })
      : { status: 'absent' }

  const children = (context.childIdsByParentKey.get(agentIdentityKey(identity)) ?? [])
    .map((childId) => context.builtByKey.get(agentIdentityKey(subagentIdentity(childId))))
    .filter((node): node is AgentTreeNode => node !== undefined)

  return {
    identity,
    metaStatus,
    isTeammate: metaStatus.status === 'ok' && metaStatus.meta.teamName !== undefined,
    children
  }
}
