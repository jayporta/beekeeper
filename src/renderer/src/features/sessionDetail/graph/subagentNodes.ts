import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { AgentGraphNode } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'
import { subagentNode } from './subagentNode'
import { nodeWorkflows, workflowOf, workflowRunNodes } from './workflowRunNodes'

/**
 * Builds the subagent nodes of a session, each under the one that spawned it.
 * An agent whose report is missing or errored is kept, with no tokens. A
 * workflow agent the lead spawned sits under its run's node, after the plain
 * subagents; one nested under another agent stays under it. It walks the tree
 * without recursing, so a deep spawn chain can't overflow the stack.
 *
 * @param detail - The session's agent tree, reports, and workflow runs.
 * @param ownerRef - The session whose transcripts hold the subagents.
 * @returns The root's direct subagents and run nodes, or none when the subagents folder couldn't be read.
 */
export function buildSubagentNodes(
  detail: SessionDetailDto,
  ownerRef: SessionRefDto
): readonly AgentGraphNode[] {
  if (!detail.subagents.ok) return []

  const reports = new Map<string, AgentReportDto | null>()
  for (const { agentId, report } of detail.subagents.value) {
    reports.set(agentId, report.ok ? report.value : null)
  }
  const workflows = nodeWorkflows(detail.workflowRuns)

  const flat = flattenPreorder(detail.tree)
  const childrenOf: AgentGraphNode[][] = flat.nodes.map(() => [])
  const runAgents = new Map<string, AgentGraphNode[]>()
  for (let i = flat.nodes.length - 1; i > 0; i -= 1) {
    const dto = flat.nodes[i]
    const parentIndex = flat.parents[i]
    const siblings = parentIndex === undefined ? undefined : childrenOf[parentIndex]
    if (dto === undefined || dto.agentId === null || siblings === undefined) continue
    const node = subagentNode({
      agentId: dto.agentId,
      meta: dto.meta,
      report: reports.get(dto.agentId) ?? null,
      ownerRef,
      workflow: dto.workflowRunId === null ? null : workflowOf(workflows, dto.workflowRunId),
      children: (childrenOf[i] ?? []).reverse()
    })
    if (parentIndex === 0 && dto.workflowRunId !== null) {
      const run = runAgents.get(dto.workflowRunId) ?? []
      run.push(node)
      runAgents.set(dto.workflowRunId, run)
    } else {
      siblings.push(node)
    }
  }
  for (const agents of runAgents.values()) agents.reverse()
  return [
    ...(childrenOf[0] ?? []).reverse(),
    ...workflowRunNodes({ ownerRef, workflows, agents: runAgents })
  ]
}
