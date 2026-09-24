import type { IpcResult } from './ipcResult'

/** Token counts by billing class. */
export interface TokenCountsDto {
  /** Input tokens. */
  readonly input: number
  /** Output tokens. */
  readonly output: number
  /** Tokens read from the prompt cache. */
  readonly cacheRead: number
  /** Tokens written to the cache with a 5-minute window. */
  readonly cacheWrite5m: number
  /** Tokens written to the cache with a 1-hour window. */
  readonly cacheWrite1h: number
}

/** What a token group costs: a price, no known price, or free. */
export type PriceDto =
  | { readonly kind: 'priced'; readonly usd: number }
  | { readonly kind: 'unpriced'; readonly reason: 'unknown-model' | 'unknown-speed' }
  | { readonly kind: 'free' }

/** Tokens one agent used on one model and speed. */
export interface TokenGroupDto {
  /** The model id as recorded. */
  readonly model: string
  /** The speed tier, `standard` when none was recorded. */
  readonly speed: string
  /** The tokens used. */
  readonly tokens: TokenCountsDto
  /** The API-equivalent price of the tokens. */
  readonly price: PriceDto
}

/** One file an agent's `Edit` or `Write` call touched. */
export interface FileTouchDto {
  /** The path exactly as the tool reported it. Render as plain text only. */
  readonly filePath: string
  /** What the tool did to the file. */
  readonly operation: 'edit' | 'create' | 'update'
}

/** One agent's usage and file touches. */
export interface AgentReportDto {
  /** Tokens by model and speed. */
  readonly tokenGroups: readonly TokenGroupDto[]
  /** How many assistant messages were credited to the agent. */
  readonly messageCount: number
  /** How many lines of its transcript could not be read. */
  readonly skippedLines: number
  /** The files its tool calls touched. */
  readonly fileTouches: readonly FileTouchDto[]
}

/** The subagent meta fields the renderer may see. Unknown fields are dropped. */
export interface AgentMetaDto {
  /** The agent type, such as `Explore`. */
  readonly agentType: string
  /** The task description. */
  readonly description?: string
  /** The model the agent ran on. */
  readonly model?: string
  /** The tool use that spawned it. */
  readonly toolUseId?: string
  /** The subagent that spawned it. */
  readonly parentAgentId?: string
  /** How deep in the spawn chain it is. */
  readonly spawnDepth?: number
  /** Whether the user stopped it. */
  readonly stoppedByUser?: boolean
  /** The worktree path it ran in. Display only. */
  readonly worktreePath?: string
  /** The worktree branch it ran on. */
  readonly worktreeBranch?: string
  /** The team it joined, when it is a teammate. */
  readonly teamName?: string
  /** Its name within the team. */
  readonly name?: string
  /** The kind of task. */
  readonly taskKind?: string
  /** Whether it forked the lead's context. */
  readonly isFork?: boolean
}

/** Why an agent's meta file exists but couldn't be used. */
export type AgentMetaErrorReason =
  | 'missing'
  | 'symlink'
  | 'not-a-file'
  | 'too-large'
  | 'invalid-json'
  | 'invalid-shape'
  | 'unreadable'

/** Whether an agent's meta was found and readable. */
export type AgentMetaStatusDto =
  | { readonly status: 'ok'; readonly meta: AgentMetaDto }
  | { readonly status: 'absent' }
  | { readonly status: 'error'; readonly reason: AgentMetaErrorReason }

/** One node in a session's agent tree. */
export interface AgentNodeDto {
  /** The subagent's id, or `null` for the lead. */
  readonly agentId: string | null
  /** Whether the agent's meta was found and readable. */
  readonly meta: AgentMetaStatusDto
  /** Whether the agent joined a team. */
  readonly isTeammate: boolean
  /** The agent's direct children, ordered by id. */
  readonly children: readonly AgentNodeDto[]
}

/** One subagent's report, or why its transcript couldn't be read. */
export interface SubagentReportDto {
  /** The subagent's id. */
  readonly agentId: string
  /** Its report, or a code-only error. */
  readonly report: IpcResult<AgentReportDto>
}
