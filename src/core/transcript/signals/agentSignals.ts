/** The longest gap between a tool call and its result. */
export interface ToolWait {
  /** The gap, in milliseconds. */
  readonly ms: number
  /** The name of the tool that was called. */
  readonly tool: string
}

/** Raw counts of the signs that an agent went off the rails, from its own transcript. */
export interface AgentSignals {
  /** Tool results with `is_error: true`, including calls a hook blocked or a person denied. */
  readonly toolErrors: number
  /** The longest run of consecutive errored tool results. */
  readonly longestErrorStreak: number
  /** The longest run of identical Bash commands, ignoring other tools between them. 0 with no Bash calls. */
  readonly longestBashRepeat: number
  /** `compact_boundary` system records. */
  readonly compactions: number
  /** `agents_killed` system records. */
  readonly agentsKilled: number
  /** The longest tool wait, or `null` when no call has a usable pair of timestamps. */
  readonly longestToolWait: ToolWait | null
  /** Whether events were dropped at a cap, so the counts may be low. */
  readonly partial: boolean
}

/** The signals of an agent with no events. */
export const EMPTY_AGENT_SIGNALS: AgentSignals = {
  toolErrors: 0,
  longestErrorStreak: 0,
  longestBashRepeat: 0,
  compactions: 0,
  agentsKilled: 0,
  longestToolWait: null,
  partial: false
}
