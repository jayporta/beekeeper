import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import type { AgentGraphNode } from './agentGraphNode'
import { sessionFacts } from './sessionFacts'

/**
 * Builds the node for a teammate's own session, with no children: its
 * subagents are not part of the node.
 *
 * @param row - The teammate's row in the sessions list.
 * @param leadRef - The lead's session, to tell a teammate in another folder.
 * @returns The node.
 */
export function teammateNode(row: SessionRow, leadRef: SessionRefDto): AgentGraphNode {
  const { item } = row
  const facts = sessionFacts(item)
  return {
    key: `mate:${sessionKey(item)}`,
    kind: 'teammate',
    name: row.label.text,
    agentType: facts.agentType,
    model: facts.model,
    tokens: facts.tokens,
    partial: facts.partial,
    stopped: facts.stopped,
    marks: facts.marks,
    subagentsNotLoaded: item.subagentCount !== 0,
    folder: item.projectDirName === leadRef.projectDirName ? null : item.projectDirName,
    selection: {
      kind: 'teammate',
      ref: { projectDirName: item.projectDirName, sessionId: item.sessionId }
    },
    workflow: null,
    children: []
  }
}
