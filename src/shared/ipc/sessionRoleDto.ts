/** A lead session's role. */
export interface LeadSessionRoleDto {
  /** Discriminates the role. */
  readonly kind: 'lead'
}

/** A teammate agent session's role. */
export interface AgentSessionRoleDto {
  /** Discriminates the role. */
  readonly kind: 'agent'
  /** The agent's type, or `null` when unknown. */
  readonly agentType: string | null
  /** The agent's name, or `null` when unknown. */
  readonly agentName: string | null
  /** The team the agent belongs to, or `null` when unknown. */
  readonly teamName: string | null
}

/**
 * Whether a top-level session is a lead or a teammate agent. `lead` means
 * the transcript carried no agent marker, as one written by an older Claude
 * Code version does, rather than a claim that the session led a team.
 */
export type SessionRoleDto = LeadSessionRoleDto | AgentSessionRoleDto
