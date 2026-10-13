import type { AgentGraphNode, RootAgentGraphNode } from '../../../shared/agentGraph/agentGraphNode'
import type { AgentReportDto, SubagentReportDto } from '../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { cardFigures } from '../../../shared/sessions/cardFigures'
import { replaceUnprintable } from '../../../core/transcript/replaceUnprintable'
import type { PaneFile, PaneNode, PaneView } from './paneView'

/** How many files a node keeps; the count of all of them is kept beside. */
export const MAX_FILES_PER_NODE = 200

/** A node's files, their count and whether the list may be short; `files` is `null` when they show elsewhere. */
interface NodeFiles {
  readonly files: readonly PaneFile[] | null
  readonly count: number | null
  readonly incomplete: boolean
}

/** The files an agent changed, from its report, cleaned and cut to the first {@link MAX_FILES_PER_NODE}. */
function filesOfReport(report: AgentReportDto): NodeFiles {
  return {
    files: report.fileTouches
      .slice(0, MAX_FILES_PER_NODE)
      .map(({ filePath, operation }) => ({ path: replaceUnprintable(filePath), operation })),
    count: report.fileTouches.length,
    incomplete: report.fileListIncomplete
  }
}

/** What a detail holds, looked up by subagent id. */
interface DetailIndex {
  readonly detail: SessionDetailDto
  readonly reports: ReadonlyMap<string, SubagentReportDto>
}

function indexDetail(detail: SessionDetailDto): DetailIndex {
  const entries = detail.subagents.ok ? detail.subagents.value : []
  return { detail, reports: new Map(entries.map((entry) => [entry.agentId, entry])) }
}

/** The files of a node: the lead's and each subagent's from their reports, none for a teammate session or a workflow run. */
function filesOfNode(node: AgentGraphNode, index: DetailIndex): NodeFiles {
  if (node.key === 'lead') return filesOfReport(index.detail.lead)
  if (node.selection?.kind !== 'subagent') return { files: null, count: null, incomplete: false }
  const found = index.reports.get(node.selection.agentId)
  return found?.report.ok === true
    ? filesOfReport(found.report.value)
    : { files: [], count: 0, incomplete: true }
}

/** Maps a graph node and everything below it to plain, cleaned pane nodes. */
function toPaneNode(node: AgentGraphNode, index: DetailIndex): PaneNode {
  const { files, count, incomplete } = filesOfNode(node, index)
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
    fileCount: count,
    filesIncomplete: incomplete,
    children: node.children.map((child) => toPaneNode(child, index))
  }
}

/** The tokens of the lead and every subagent below it, for a session the list doesn't hold, which leaves out a workflow run's roll-up and each teammate's own session. */
function totalTokensOf(node: AgentGraphNode): number | null {
  const own = node.key === 'lead' || node.key.startsWith('sub:') ? node.tokens : null
  return node.children.reduce<number | null>((total, child) => {
    const below = totalTokensOf(child)
    return below === null ? total : (total ?? 0) + below
  }, own)
}

/** The session's tokens as the desktop's session card shows them, else the lead's and subagents' from the detail. */
function totalsOf(
  item: SessionListItemDto | null,
  root: RootAgentGraphNode
): { readonly tokens: number | null; readonly partial: boolean } {
  if (item === null) return { tokens: totalTokensOf(root), partial: false }
  const figures = cardFigures(item).figures
  return { tokens: figures?.tokens ?? null, partial: figures?.tokensPartial ?? false }
}

/** What {@link toPaneView} needs. */
interface ToPaneViewInput {
  /** The session the graph is of. */
  readonly sessionId: string
  /** The session's graph. */
  readonly root: RootAgentGraphNode
  /** The session's entry in the sessions list, or `null` when the list doesn't hold it. */
  readonly rootItem: SessionListItemDto | null
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
 * @param input - The session's id, graph, list entry, detail and name, and the time.
 * @returns A `ready` view.
 */
export function toPaneView(input: ToPaneViewInput): PaneView {
  const { sessionId, root, rootItem, detail, label, nowMs } = input
  const totals = totalsOf(rootItem, root)
  return {
    sessionId,
    status: 'ready',
    errorCode: null,
    label: replaceUnprintable(label),
    totalTokens: totals.tokens,
    totalTokensPartial: totals.partial,
    root: toPaneNode(root, indexDetail(detail)),
    refreshedAtMs: nowMs
  }
}
