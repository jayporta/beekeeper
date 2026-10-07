import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { SelectedAgent } from '@renderer/features/navigation/state/useNavigationStore'

/** Where the data for the inspected agent lives. */
export interface InspectionTarget {
  /** The session whose detail holds the agent. */
  readonly ownerRef: SessionRefDto
  /** The subagent's id, or `null` for the owner session's own agent: a lead, or a teammate in its own session. */
  readonly agentId: string | null
}

/** A selection that picks one agent: any but a workflow run, which groups agents. */
export type AgentSelection = Exclude<SelectedAgent, { readonly kind: 'workflow' }>

/**
 * Works out whose detail describes a selected agent. The root (no selection)
 * and a teammate are the agent of a session, the viewed one or the teammate's
 * own, and a subagent lives in the transcripts of whichever session spawned it.
 *
 * @param selection - The inspected agent's selection, or `null` for the root.
 * @param sessionRef - The viewed session.
 * @returns The session to read, and which of its agents.
 */
export function inspectionTarget(
  selection: AgentSelection | null,
  sessionRef: SessionRefDto
): InspectionTarget {
  if (selection === null) return { ownerRef: sessionRef, agentId: null }
  if (selection.kind === 'teammate') return { ownerRef: selection.ref, agentId: null }
  return { ownerRef: selection.ownerRef, agentId: selection.agentId }
}
