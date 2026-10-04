import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'

/** What a session's list entry says about the agent that ran it. */
export interface SessionFacts {
  /** The agent's type, or `null` when the session isn't an agent's or says none. */
  readonly agentType: string | null
  /** The session's latest model, or `null`. */
  readonly model: string | null
  /** The session's recorded token total, or `null` when it recorded none. */
  readonly tokens: number | null
  /** Whether the session's summary couldn't be read, or skipped transcript lines. */
  readonly partial: boolean
  /** Whether the session is a teammate its lead stopped. */
  readonly stopped: boolean
}

/**
 * Reads the facts a graph node shows from a session's list entry.
 *
 * @param item - The session's list entry, or `null` when it isn't in the list.
 * @returns What the entry says. Every field is empty for `null`.
 */
export function sessionFacts(item: SessionListItemDto | null): SessionFacts {
  const stopped = item?.team?.kind === 'teammate' && item.team.stopped
  if (item === null) return { agentType: null, model: null, tokens: null, partial: false, stopped }
  if (!item.summary.ok) {
    return { agentType: null, model: null, tokens: null, partial: true, stopped }
  }

  const { role, model, usage, skippedLines } = item.summary.value
  return {
    agentType: role.kind === 'agent' ? role.agentType : null,
    model,
    tokens: usage?.totalTokens ?? null,
    partial: skippedLines > 0,
    stopped
  }
}
