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

/** One file an agent's `Edit` or `Write` call, or a Bash command, touched. */
export interface FileTouchDto {
  /** The path as the tool reported it. Render as plain text only. */
  readonly filePath: string
  /** What the tool did to the file. `change`: changed, but the result gave no detail on how. */
  readonly operation: 'edit' | 'create' | 'update' | 'delete' | 'change'
  /** Which kind of call reported it: `edit-write` for an `Edit`/`Write` call, `bash` for a Bash command's detected changes. */
  readonly source: 'edit-write' | 'bash'
}

/** The span between an agent's first and last timestamped assistant messages, and the active time within it. */
export interface AgentActivityDto {
  /** The earliest message timestamp, in epoch milliseconds. */
  readonly earliestMs: number
  /** The latest message timestamp, in epoch milliseconds. */
  readonly latestMs: number
  /** The time between its messages, in milliseconds, with every gap longer than the idle cutoff left out. */
  readonly activeMs: number
}

/** One agent's usage, file touches, and activity span. */
export interface AgentReportDto {
  /** Tokens by model and speed. */
  readonly tokenGroups: readonly TokenGroupDto[]
  /** How many assistant messages were credited to the agent. */
  readonly messageCount: number
  /** How many lines of its transcript could not be read. */
  readonly skippedLines: number
  /** The files its tool calls touched. */
  readonly fileTouches: readonly FileTouchDto[]
  /**
   * Whether `fileTouches` may be missing files: one of its Bash commands
   * reported that it could not tell what changed (unavailable, shared, or
   * skipped), changed more files than the per-result cap, named a path that
   * could not be listed, or gave no usable list of changed files; or its Bash
   * touches passed the per-transcript or per-session cap, or it had more
   * incomplete results than are tracked. It can also over-report: a fork
   * holds copies of the lead's incomplete results, which count toward its own
   * limit, so a fork that copied past it is marked even if none were its own;
   * past the session's limit on tracked incomplete results, a fork's copy of
   * one marks the fork too; and a lead touch cut at the per-session cap is
   * cut in a fork's copy as well, which marks the fork. Not set when a Bash
   * result only truncated its diff hunks.
   */
  readonly fileListIncomplete: boolean
  /**
   * The span of its own assistant messages and the active time within it, or
   * `null` when none has a usable timestamp. A fork's copies of the lead's
   * messages don't count.
   */
  readonly activity: AgentActivityDto | null
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
  /** The team named in the meta, if any. */
  readonly teamName?: string
  /** The name given in the meta, if any. */
  readonly name?: string
  /** The kind of task. */
  readonly taskKind?: string
  /** The title of the workflow phase it ran in, if any. */
  readonly workflowPhase?: string
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
  /** The id of the workflow run the agent ran in, or `null` for the lead and for an agent outside a workflow. */
  readonly workflowRunId: string | null
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
