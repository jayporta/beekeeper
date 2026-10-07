import { compareCodeUnits } from '../shared/compareCodeUnits'
import type { AgentId } from '../transcript/ids'
import type { WorkflowRunId } from '../transcript/workflowRunId'
import type { AgentHierarchy } from './agentHierarchy'
import {
  agentIdentityKey,
  leadIdentity,
  subagentIdentity,
  type AgentIdentity
} from './agentIdentity'
import type { ParentLinkInput } from './resolveParents'
import type { SubagentMetaStatus } from './subagentMetaStatus'

/** One subagent's id and its resolved meta status, as input to `resolveAgentHierarchy`. */
export type AgentTreeInput = ParentLinkInput

/** One node in a session's agent tree: the lead or a subagent. */
export interface AgentTreeNode {
  /** Which agent this node represents. */
  readonly identity: AgentIdentity
  /** The node's meta status: `absent` for the lead, which never has one. */
  readonly metaStatus: SubagentMetaStatus
  /** The workflow run the agent belongs to, or `null` for the lead and for a subagent spawned outside a workflow. */
  readonly workflowRunId: WorkflowRunId | null
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
 * Builds a session's agent tree from a resolved hierarchy, with the lead as
 * root. A subagent with no `parentOf` entry hangs off the lead, and children
 * at each level are ordered by agent id.
 *
 * Tree construction runs iteratively, in time proportional to the number of
 * subagents, so a deep resulting tree costs neither quadratic time nor a
 * stack overflow.
 *
 * @param hierarchy - The session's subagents deduped by id, with each one's
 * resolved parent, as {@link AgentHierarchy} describes. The list must hold
 * no repeated id and `parentOf` must be acyclic, which
 * `resolveAgentHierarchy` guarantees; given a repeated id a subtree
 * appears twice, and given a cycle its members and everything beneath
 * them are left out of the tree.
 * @returns The lead node, with every subagent nested somewhere beneath it.
 */
export function buildAgentTree(hierarchy: AgentHierarchy<AgentTreeInput>): AgentTreeNode {
  const { subagents: deduped, parentOf } = hierarchy
  const inputByAgentId = new Map<string, AgentTreeInput>(deduped.map((s) => [s.agentId, s]))

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
  const input =
    identity.kind === 'subagent' ? context.inputByAgentId.get(identity.agentId) : undefined
  const metaStatus: SubagentMetaStatus = input?.metaStatus ?? { status: 'absent' }

  const children = (context.childIdsByParentKey.get(agentIdentityKey(identity)) ?? [])
    .map((childId) => context.builtByKey.get(agentIdentityKey(subagentIdentity(childId))))
    .filter((node): node is AgentTreeNode => node !== undefined)

  return {
    identity,
    metaStatus,
    workflowRunId: input?.workflowRunId ?? null,
    children
  }
}
