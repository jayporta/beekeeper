/** A transcript that belongs to a lead session, which carries no agent markers. */
export interface LeadSessionRole {
  /** Discriminates the role. */
  readonly kind: 'lead'
}

/**
 * A transcript written by a teammate agent as its own top-level file,
 * rather than under a session's `subagents/` folder.
 */
export interface AgentSessionRole {
  /** Discriminates the role. */
  readonly kind: 'agent'
  /** The agent's type from its `agent-setting` record, or `null` when absent or unusable. */
  readonly agentType: string | null
  /** The agent's name, or `null` when absent or unusable. */
  readonly agentName: string | null
  /** The team the agent belongs to, or `null` when absent or unusable. */
  readonly teamName: string | null
}

/**
 * Whether a top-level transcript belongs to a lead session or to a teammate
 * agent. A transcript with no agent markers reads as a lead.
 */
export type SessionRole = LeadSessionRole | AgentSessionRole
