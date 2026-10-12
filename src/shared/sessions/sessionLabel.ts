import type { SessionListItemDto } from '../ipc/sessionListDto'

/** How a session is named on its card or chip. */
export interface SessionLabel {
  /** The name: a title, an agent's name and type, or a placeholder. */
  readonly text: string
  /** A short id to show beside a placeholder name, or `null` when the name needs none. */
  readonly idHint: string | null
}

/** The words a session label uses, in the caller's language. */
export interface SessionLabelWords {
  /** The name of a session whose summary can't be read. */
  readonly unreadable: string
  /** The name of a session with no title. */
  readonly untitled: string
  /** A teammate's name from its agent name and type. */
  readonly agentName: (name: string, type: string) => string
}

/**
 * The first characters of a session or agent id, enough to tell them apart at a glance.
 *
 * @param id - The full id.
 * @returns The short id.
 */
export function shortId(id: string): string {
  return id.slice(0, 8)
}

/**
 * Names a session for its card or chip. A teammate agent is named by its agent name
 * and type, since most have no title. Any other session is named by its
 * title, with a placeholder and a short id when it has none or can't be read.
 *
 * @param item - A session list item.
 * @param words - The placeholders and the agent name format, in the caller's language.
 * @returns The label.
 */
export function sessionLabel(item: SessionListItemDto, words: SessionLabelWords): SessionLabel {
  if (!item.summary.ok) return { text: words.unreadable, idHint: shortId(item.sessionId) }

  const { role, title } = item.summary.value
  if (role.kind === 'agent') {
    const { agentName, agentType } = role
    if (agentName !== null && agentType !== null) {
      return { text: words.agentName(agentName, agentType), idHint: null }
    }
    return { text: agentName ?? agentType ?? shortId(item.sessionId), idHint: null }
  }

  return title === null
    ? { text: words.untitled, idHint: shortId(item.sessionId) }
    : { text: title, idHint: null }
}
