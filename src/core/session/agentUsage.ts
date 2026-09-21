import type { TokenGroup } from './tokenGroup'

/** One agent's token usage for a session, as scanned from its transcript. */
export interface AgentUsage {
  /** The agent's token usage, grouped by raw model id and resolved speed. */
  readonly tokenGroups: readonly TokenGroup[]
  /** The number of distinct messages this agent owns. */
  readonly messageCount: number
  /**
   * The number of lines this agent's transcript couldn't contribute as a
   * valid assistant record: too long to buffer, not valid JSON, valid JSON
   * that isn't an object, or an `assistant` record that failed schema
   * validation.
   */
  readonly skippedLines: number
}
