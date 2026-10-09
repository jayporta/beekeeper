import type {
  AgentMetaDto,
  AgentMetaStatusDto,
  AgentReportDto
} from '../../../../../shared/ipc/agentDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { AgentGraphNode, AgentKind, NodeWorkflow } from './agentGraphNode'
import { agentName } from './agentName'
import { nodeMarks } from './nodeMarks'
import { isPartialReport, reportTokens } from './reportFacts'

/** What {@link subagentNode} needs to build one node. */
export interface SubagentNodeInput {
  /** The subagent's id. */
  readonly agentId: string
  /** The subagent's meta status. */
  readonly meta: AgentMetaStatusDto
  /** The subagent's report, or `null` when it could not be read. */
  readonly report: AgentReportDto | null
  /** The session whose transcript holds the subagent. */
  readonly ownerRef: SessionRefDto
  /** The workflow run the agent ran in, or `null` for an agent outside any run. */
  readonly workflow: NodeWorkflow | null
  /** The agents this one spawned. */
  readonly children: readonly AgentGraphNode[]
}

/**
 * Whether a meta describes an in-process teammate: one recorded as a
 * subagent, spawned at depth 0 into a team under a name. A fork, which has
 * no name, is not one.
 */
function isInProcessTeammate(meta: AgentMetaDto): boolean {
  return meta.spawnDepth === 0 && meta.teamName !== undefined && meta.name !== undefined
}

/**
 * Builds the node for one subagent in a session's transcript tree. A
 * subagent whose meta is absent or unreadable is still a node, named by its
 * short id, and so is one whose report could not be read, with no tokens.
 *
 * @param input - The subagent's identity, meta, report, owner, run, and children.
 * @returns The node.
 */
export function subagentNode(input: SubagentNodeInput): AgentGraphNode {
  const { agentId, meta, report, ownerRef, workflow, children } = input
  const kind: AgentKind =
    meta.status === 'ok' && isInProcessTeammate(meta.meta) ? 'teammate' : 'subagent'
  const details = meta.status === 'ok' ? meta.meta : null
  return {
    key: `sub:${sessionKey(ownerRef)}:${agentId}`,
    kind,
    name: agentName(meta, agentId),
    agentType: details?.agentType ?? null,
    model: details?.model ?? null,
    tokens: report === null ? null : reportTokens(report),
    partial: report === null || isPartialReport(report),
    stopped: details?.stoppedByUser === true,
    marks: report === null ? null : nodeMarks(report.signals),
    subagentsNotLoaded: false,
    folder: null,
    selection: { kind: 'subagent', ownerRef, agentId },
    workflow,
    children
  }
}
