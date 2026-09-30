import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** How a session is named in the table. */
export interface SessionLabel {
  /** The name: a title, an agent's name and type, or a placeholder. */
  readonly text: string
  /** A short id to show beside a placeholder name, or `null` when the name needs none. */
  readonly idHint: string | null
}

/** The first characters of a session id, enough to tell sessions apart at a glance. */
function shortId(item: SessionListItemDto): string {
  return item.sessionId.slice(0, 8)
}

/**
 * Names a session for the table. A teammate agent is named by its agent name
 * and type, since most have no title. Any other session is named by its
 * title, with a placeholder and a short id when it has none or can't be read.
 *
 * @param item - A session list item.
 * @returns The label.
 */
export function sessionLabel(item: SessionListItemDto): SessionLabel {
  if (!item.summary.ok) return { text: 'Unreadable session', idHint: shortId(item) }

  const { role, title } = item.summary.value
  if (role.kind === 'agent') {
    const { agentName, agentType } = role
    if (agentName !== null && agentType !== null) {
      return { text: `${agentName} (${agentType})`, idHint: null }
    }
    return { text: agentName ?? agentType ?? shortId(item), idHint: null }
  }

  return title === null
    ? { text: 'Untitled session', idHint: shortId(item) }
    : { text: title, idHint: null }
}
