import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import type { NodeMarks } from './agentGraphNode'
import { nodeMarks } from './nodeMarks'

/** What a session's list entry says about the agent that ran it. */
export interface SessionFacts {
  /** The agent's type, or `null` when the session isn't an agent's or says none. */
  readonly agentType: string | null
  /** The session's latest model, or `null`. */
  readonly model: string | null
  /** The tokens of the session's own transcript, excluding its subagents, or `null` when it has none. */
  readonly tokens: number | null
  /** Whether the session's summary couldn't be read, skipped transcript lines, or capped its signals. */
  readonly partial: boolean
  /** Whether the session is a teammate its lead stopped. */
  readonly stopped: boolean
  /**
   * The tool error and compaction counts of the session's own transcript, or
   * `null` when the session isn't in the list or its summary couldn't be read.
   */
  readonly marks: NodeMarks | null
}

/**
 * Reads the facts a graph node shows from a session's list entry.
 *
 * @param item - The session's list entry, or `null` when it isn't in the list.
 * @returns What the entry says. Every field is empty for `null`.
 */
export function sessionFacts(item: SessionListItemDto | null): SessionFacts {
  const stopped = item?.team?.kind === 'teammate' && item.team.stopped
  if (item === null)
    return { agentType: null, model: null, tokens: null, partial: false, stopped, marks: null }
  if (!item.summary.ok) {
    return { agentType: null, model: null, tokens: null, partial: true, stopped, marks: null }
  }

  const { role, model, transcriptTokens, skippedLines, signals } = item.summary.value
  return {
    agentType: role.kind === 'agent' ? role.agentType : null,
    model,
    tokens: transcriptTokens,
    partial: skippedLines > 0 || signals.partial,
    stopped,
    marks: nodeMarks(signals)
  }
}
