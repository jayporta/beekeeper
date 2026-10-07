import type { SelectedAgent } from '@renderer/features/navigation/state/useNavigationStore'

/**
 * A graph node's identity: `lead` for the viewed session's own agent,
 * `sub:<folder>/<session>:<agentId>` for a subagent in a transcript, and
 * `mate:<folder>/<session>` for a teammate's own session, and
 * `run:<folder>/<session>:<runId>` for a workflow run. A subagent's or run's
 * key names the session that holds it, so a teammate's subagents never collide
 * with the lead's.
 */
export type AgentKey = 'lead' | `sub:${string}` | `mate:${string}` | `run:${string}`

/** What a node is: the viewed session's own agent, a separate teammate session, a sidechain inside a transcript, or a workflow run that groups its agents. */
export type AgentKind = 'lead' | 'teammate' | 'subagent' | 'workflow'

/** The facts of one workflow run, shared by its node and each agent inside it. */
export interface NodeWorkflow {
  /** The run's id. */
  readonly runId: string
  /** The workflow's name from the run's record, or the run id when the record has none or is missing. Transcript-derived: render as plain text. */
  readonly name: string
  /** Whether the record says the run finished successfully. `false` when there is no record. */
  readonly completed: boolean
  /** Whether another run of the same session has the same name, so the run id is shown to tell them apart. */
  readonly duplicateName: boolean
  /** The titles of the run's phases, in order, empty when there is no record. Transcript-derived: render as plain text. */
  readonly phases: readonly string[]
}

/** One node in the spawn graph: an agent, or a workflow run that holds its agents. */
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
  /** Whether the agent may have subagents the graph doesn't hold yet: a teammate whose subagents haven't been loaded and whose session has subagents or an unknown number of them. */
  readonly subagentsNotLoaded: boolean
  /** The folder of a teammate whose session lives in another folder than the lead's, otherwise `null`. Transcript-derived. */
  readonly folder: string | null
  /** The selection that picks this node, or `null` for the root. */
  readonly selection: SelectedAgent | null
  /** The workflow run the node is, or the agent in it ran in, or `null` for any other node. */
  readonly workflow: NodeWorkflow | null
  /** The agents it spawned, then, for the lead, its teammate sessions. A workflow run holds the agents that ran in it. */
  readonly children: readonly AgentGraphNode[]
}

/** The root of the graph: the viewed session's agent, with what the session's team lists could not account for. */
export interface RootAgentGraphNode extends AgentGraphNode {
  /** How many teammates the lead spawned that never appeared as sessions. `0` for a session that isn't a lead. */
  readonly missingTeammates: number
  /** Whether the lead's spawn or stop lists were capped, so `missingTeammates` may undercount. */
  readonly teamListsTruncated: boolean
}
