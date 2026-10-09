/** Claude Code's own cost estimate for one agent of a session. */
export interface ReportedAgentCostDto {
  /** The subagent's id as Claude Code reported it, or `null` for the lead. Transcript-derived: render as plain text. */
  readonly agentId: string | null
  /** The agent's reported cost in USD. */
  readonly costUsd: number
}

/** The token totals Claude Code reported for a session. */
export interface ReportedTokensDto {
  /** Input tokens. */
  readonly input: number
  /** Output tokens. */
  readonly output: number
  /** Tokens read from the prompt cache. */
  readonly cacheRead: number
  /** Tokens written to the prompt cache. */
  readonly cacheCreation: number
}

/** What Claude Code's telemetry reported for one session since beekeeper started listening. */
export interface ReportedCostDto {
  /** The reported cost across every agent, in USD. */
  readonly costUsd: number
  /** How many API requests were reported. */
  readonly requests: number
  /** The reported token totals. */
  readonly tokens: ReportedTokensDto
  /** The reported cost split by agent, in the order each agent first reported. */
  readonly byAgent: readonly ReportedAgentCostDto[]
}
