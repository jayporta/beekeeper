import type { SessionRow } from '../../../../shared/sessions/sessionRow'
import { shortId } from '../../../../shared/sessions/sessionLabel'

/** How a teammate's row names it. */
export interface TeammateName {
  /** The name: the agent's name, else its type, else a short id. */
  readonly name: string
  /** The agent's type to show beside its name, or `null` when the name already is the type or there is none. */
  readonly type: string | null
}

/**
 * Names a teammate for its sub-row: its agent name with its type beside it,
 * its type alone when it has no name, else a short id. A teammate whose
 * summary couldn't be read keeps its card label.
 *
 * @param teammate - The teammate's row.
 * @returns The name and the type.
 */
export function teammateName({ item, label }: SessionRow): TeammateName {
  if (!item.summary.ok) return { name: label.text, type: null }
  const { role } = item.summary.value
  if (role.kind !== 'agent') return { name: label.text, type: null }
  if (role.agentName !== null) return { name: role.agentName, type: role.agentType }
  return { name: role.agentType ?? shortId(item.sessionId), type: null }
}
