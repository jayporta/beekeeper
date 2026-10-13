import type { AgentGraphNode, RootAgentGraphNode } from '../../../shared/agentGraph/agentGraphNode'
import type { AgentReportDto } from '../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import { replaceUnprintable } from '../../../core/transcript/replaceUnprintable'
import type { PaneFile, PaneNode, PaneView } from './paneView'

/** A node's files and whether the list may be short, or `null` files when they show elsewhere. */
interface NodeFiles {
  readonly files: readonly PaneFile[] | null
  readonly incomplete: boolean
}

/** The files an agent changed, from its report. */
function filesOfReport(report: AgentReportDto): NodeFiles {
  return {
    files: report.fileTouches.map(({ filePath, operation }) => ({
      path: replaceUnprintable(filePath),
      operation
    })),
    incomplete: report.fileListIncomplete
  }
}

/** The files of a node: the lead's and each subagent's from their reports, none for a teammate session or a workflow run. */
function filesOfNode(node: AgentGraphNode, detail: SessionDetailDto): NodeFiles {
  if (node.key === 'lead') return filesOfReport(detail.lead)
  if (node.selection?.kind !== 'subagent') return { files: null, incomplete: false }
  const { agentId } = node.selection
  const found = detail.subagents.ok
    ? detail.subagents.value.find((entry) => entry.agentId === agentId)
    : undefined
  return found?.report.ok === true
    ? filesOfReport(found.report.value)
    : { files: [], incomplete: true }
}

/** Maps a graph node and everything below it to plain, cleaned pane nodes. */
function toPaneNode(node: AgentGraphNode, detail: SessionDetailDto): PaneNode {
  const { files, incomplete } = filesOfNode(node, detail)
  return {
    key: node.key,
    kind: node.kind,
    name: replaceUnprintable(node.name),
    agentType: node.agentType === null ? null : replaceUnprintable(node.agentType),
    tokens: node.tokens,
    toolErrors: node.marks?.toolErrors ?? null,
    compactions: node.marks?.compactions ?? null,
    stopped: node.stopped,
    partial: node.partial,
    files,
    filesIncomplete: incomplete,
    children: node.children.map((child) => toPaneNode(child, detail))
  }
}

/** The tokens of the lead and every subagent below it, which leaves out a workflow run's roll-up and each teammate's own session. */
function totalTokensOf(node: AgentGraphNode): number | null {
  const own = node.key === 'lead' || node.key.startsWith('sub:') ? node.tokens : null
  return node.children.reduce<number | null>((total, child) => {
    const below = totalTokensOf(child)
    return below === null ? total : (total ?? 0) + below
  }, own)
}

/** What {@link toPaneView} needs. */
interface ToPaneViewInput {
  /** The session the graph is of. */
  readonly sessionId: string
  /** The session's graph. */
  readonly root: RootAgentGraphNode
  /** The session's detail, which holds the files. */
  readonly detail: SessionDetailDto
  /** The session's name. */
  readonly label: string
  /** When the view is built, in milliseconds since the epoch. */
  readonly nowMs: number
}

/**
 * Maps a session's agent graph to the pane's view: plain data with every
 * transcript-derived string cleaned, so it is safe to keep in state and draw.
 *
 * @param input - The session's id, graph, detail and name, and the time.
 * @returns A `ready` view.
 */
export function toPaneView(input: ToPaneViewInput): PaneView {
  const { sessionId, root, detail, label, nowMs } = input
  return {
    sessionId,
    status: 'ready',
    errorCode: null,
    label: replaceUnprintable(label),
    totalTokens: totalTokensOf(root),
    root: toPaneNode(root, detail),
    refreshedAtMs: nowMs
  }
}
