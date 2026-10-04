import type { AgentNodeDto, AgentReportDto } from '../../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { InspectionTarget } from './inspectionTarget'

/** What the inspector has for an agent: still loading, impossible to read, or its report. */
export type Inspection =
  | { readonly status: 'loading' }
  | { readonly status: 'unreadable' }
  | {
      readonly status: 'ready'
      /** The agent's usage and file touches. */
      readonly report: AgentReportDto
      /** The worktree branch the agent's meta names, or `null`. */
      readonly worktreeBranch: string | null
    }

/** Finds a subagent's node in an agent tree without recursing, so a deep tree can't overflow the stack. */
function findNode(root: AgentNodeDto, agentId: string): AgentNodeDto | undefined {
  const pending = [root]
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.agentId === agentId) return node
    pending.push(...node.children)
  }
  return undefined
}

/**
 * Reads the inspected agent out of its session's detail. A detail that arrived
 * wins over a failed refresh. A subagent whose report couldn't be read, or
 * that the detail doesn't hold, is unreadable.
 *
 * @param target - Which session's detail, and which of its agents.
 * @param query - The session's detail query: its data, and whether the last load failed.
 * @returns The inspection.
 */
export function inspectionOf(
  target: InspectionTarget,
  query: { readonly data: SessionDetailDto | undefined; readonly isError: boolean }
): Inspection {
  const { data } = query
  if (data === undefined) return { status: query.isError ? 'unreadable' : 'loading' }
  if (target.agentId === null) return { status: 'ready', report: data.lead, worktreeBranch: null }

  const entry = data.subagents.ok
    ? data.subagents.value.find((subagent) => subagent.agentId === target.agentId)
    : undefined
  if (entry === undefined || !entry.report.ok) return { status: 'unreadable' }

  const meta = findNode(data.tree, target.agentId)?.meta
  return {
    status: 'ready',
    report: entry.report.value,
    worktreeBranch: meta?.status === 'ok' ? (meta.meta.worktreeBranch ?? null) : null
  }
}
