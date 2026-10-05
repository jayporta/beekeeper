import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { AgentGraphNode } from '../graph/agentGraphNode'

/** Where the data for the inspected agent lives. */
export interface InspectionTarget {
  /** The session whose detail holds the agent. */
  readonly ownerRef: SessionRefDto
  /** The subagent's id, or `null` for the owner session's own agent: a lead, or a teammate in its own session. */
  readonly agentId: string | null
}

/**
 * Works out whose detail describes a graph node. The root and a teammate
 * node are the agent of a session, the viewed one or the teammate's own, and
 * a subagent lives in the transcripts of whichever session spawned it.
 *
 * @param node - The inspected node.
 * @param sessionRef - The viewed session.
 * @returns The session to read, and which of its agents.
 */
export function inspectionTarget(
  node: AgentGraphNode,
  sessionRef: SessionRefDto
): InspectionTarget {
  const { selection } = node
  if (selection === null) return { ownerRef: sessionRef, agentId: null }
  if (selection.kind === 'teammate') return { ownerRef: selection.ref, agentId: null }
  return { ownerRef: selection.ownerRef, agentId: selection.agentId }
}
