import type { SelectedAgent } from '@renderer/features/navigation/state/useNavigationStore'

/**
 * A graph node's identity: `lead` for the viewed session's own agent,
 * `sub:<folder>/<session>:<agentId>` for a subagent in a transcript, and
 * `mate:<folder>/<session>` for a teammate's own session. A subagent's key
 * names the session that holds it, so a teammate's subagents never collide
 * with the lead's.
 */
export type AgentKey = 'lead' | `sub:${string}` | `mate:${string}`

/** What an agent is: the viewed session's own agent, a separate teammate session, or a sidechain inside a transcript. */
export type AgentKind = 'lead' | 'teammate' | 'subagent'

/** One agent in the spawn graph. */
export interface AgentGraphNode {
  /** The node's identity, unique within the graph. */
  readonly key: AgentKey
  /**
   * What the agent is. The root is a `lead`, or a `teammate` when the viewed
   * session is itself a teammate's.
   */
  readonly kind: AgentKind
  /** The agent's name. Transcript-derived: render as plain text, isolated from the surrounding text. */
  readonly name: string
  /** The agent's type, such as `Explore`, or `null` when unknown. Transcript-derived. */
  readonly agentType: string | null
  /** The model the agent ran on, or `null` when unknown. Transcript-derived. */
  readonly model: string | null
  /** The agent's own tokens across every class, or `null` when it has no readable usage. */
  readonly tokens: number | null
  /** Whether its usage or file list may be missing something: unreadable lines, an incomplete file list, or a report that could not be read. */
  readonly partial: boolean
  /** Whether the agent was stopped. */
  readonly stopped: boolean
  /** The folder of a teammate whose session lives in another folder than the lead's, otherwise `null`. Transcript-derived. */
  readonly folder: string | null
  /** The selection that picks this node, or `null` for the root. */
  readonly selection: SelectedAgent | null
  /** The agents it spawned, then, for the lead, its teammate sessions. */
  readonly children: readonly AgentGraphNode[]
}

/** The root of the graph: the viewed session's agent, with what the session's team lists could not account for. */
export interface RootAgentGraphNode extends AgentGraphNode {
  /** How many teammates the lead spawned that never appeared as sessions. `0` for a session that isn't a lead. */
  readonly missingTeammates: number
  /** Whether the lead's spawn or stop lists were capped, so `missingTeammates` may undercount. */
  readonly teamListsTruncated: boolean
}
