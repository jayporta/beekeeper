import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import type { SessionDetailT } from '../sessionDetailT'
import type { AgentGraphNode, RootAgentGraphNode } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'
import { isPartialReport, reportTokens } from './reportFacts'
import { sessionFacts } from './sessionFacts'
import { subagentNode } from './subagentNode'
import { teammateNode } from './teammateNode'

/** Input for {@link buildAgentGraph}. */
export interface BuildAgentGraphInput {
  /** The viewed session's agent tree and reports. */
  readonly detail: SessionDetailDto
  /** The viewed session, which `detail` doesn't name by folder. */
  readonly ref: SessionRefDto
  /** The viewed session's entry in the sessions list, or `null` when it isn't listed. */
  readonly rootItem: SessionListItemDto | null
  /** The viewed session's row in the grouped sessions list, which holds its teammates, or `null`. */
  readonly rootRow: SessionRow | null
  /** The session detail translate function. */
  readonly t: SessionDetailT
}

/**
 * Builds the subagent nodes of a session, each under the one that spawned it.
 * An agent whose report is missing or errored is kept, with no tokens. It
 * walks the tree without recursing, so a deep spawn chain can't overflow the
 * stack.
 */
function buildSubagentNodes(
  detail: SessionDetailDto,
  ownerRef: SessionRefDto
): readonly AgentGraphNode[] {
  if (!detail.subagents.ok) return []

  const reports = new Map<string, AgentReportDto | null>()
  for (const { agentId, report } of detail.subagents.value) {
    reports.set(agentId, report.ok ? report.value : null)
  }

  const flat = flattenPreorder(detail.tree)
  const childrenOf: AgentGraphNode[][] = flat.nodes.map(() => [])
  for (let i = flat.nodes.length - 1; i > 0; i -= 1) {
    const dto = flat.nodes[i]
    const parentIndex = flat.parents[i]
    const siblings = parentIndex === undefined ? undefined : childrenOf[parentIndex]
    if (dto === undefined || dto.agentId === null || siblings === undefined) continue
    const children = (childrenOf[i] ?? []).reverse()
    siblings.push(
      subagentNode({
        agentId: dto.agentId,
        meta: dto.meta,
        report: reports.get(dto.agentId) ?? null,
        ownerRef,
        children
      })
    )
  }
  return (childrenOf[0] ?? []).reverse()
}

/**
 * Builds the spawn graph of a session: the viewed agent at the root, its
 * subagents nested by spawn parent, then its teammates' own sessions as the
 * root's last children. The root is a teammate when the viewed session is a
 * teammate's own. A teammate's subagents are not in the graph.
 *
 * @param input - The session's detail, ref, list entry and row, and the translate function.
 * @returns The root node.
 */
export function buildAgentGraph(input: BuildAgentGraphInput): RootAgentGraphNode {
  const { detail, ref, rootItem, rootRow, t } = input
  const facts = sessionFacts(rootItem)
  const team = rootItem?.team ?? null
  const isTeammate = team !== null && team.kind !== 'lead'
  const lead = team?.kind === 'lead' ? team.usage : null
  const teammates = (rootRow?.teammates ?? []).map((row) => teammateNode(row, ref))

  return {
    key: 'lead',
    kind: isTeammate ? 'teammate' : 'lead',
    name: isTeammate ? (rootRow?.label.text ?? t('graph.teammate')) : t('graph.lead'),
    agentType: facts.agentType,
    model: facts.model,
    tokens: reportTokens(detail.lead),
    partial: isPartialReport(detail.lead) || !detail.subagents.ok,
    stopped: facts.stopped,
    folder: null,
    selection: null,
    children: [...buildSubagentNodes(detail, ref), ...teammates],
    missingTeammates: lead?.missingTeammates ?? 0,
    teamListsTruncated: lead?.teamListsTruncated ?? false
  }
}
