import type { IpcErrorCode } from '../../../shared/ipc/ipcResult'

/** One changed file of an agent. */
export interface PaneFile {
  /** The path as the tool reported it, cleaned of unprintable characters. */
  readonly path: string
  /** What the tool did to the file: `edit`, `create`, `update`, `delete` or `change`. */
  readonly operation: string
}

/** One node of the pane's agent tree. Every string is cleaned and the node is plain data, so it can sit in `$.state`. */
export interface PaneNode {
  /** The node's identity, unique within the tree. */
  readonly key: string
  /** What the node is: `lead`, `teammate`, `subagent` or `workflow`. */
  readonly kind: string
  /** The agent's name, on one line. */
  readonly name: string
  /** The agent's type, or `null` when unknown. */
  readonly agentType: string | null
  /** The agent's own tokens, or `null` when it has no readable usage. */
  readonly tokens: number | null
  /** The tool error count, or `null` when the agent's counts aren't known. */
  readonly toolErrors: number | null
  /** The compaction count, or `null` when the agent's counts aren't known. */
  readonly compactions: number | null
  /** Whether the agent was stopped. */
  readonly stopped: boolean
  /** Whether the tokens or the file list may be missing something. */
  readonly partial: boolean
  /** The files the agent changed, or `null` when they show elsewhere (a teammate, a workflow run). */
  readonly files: readonly PaneFile[] | null
  /** Whether `files` may be missing some. */
  readonly filesIncomplete: boolean
  /** The agents under this one. */
  readonly children: readonly PaneNode[]
}

/** How the pane's data stands. `waiting` is a session that has no transcript yet. */
export type PaneStatus = 'loading' | 'ready' | 'waiting' | 'error'

/** What the pane draws: the viewed session's tree, or why there isn't one. Plain data. */
export interface PaneView {
  /** The session the view is of. */
  readonly sessionId: string
  /** How the data stands. */
  readonly status: PaneStatus
  /** The failure's code when `status` is `error`, otherwise `null`. Never a message. */
  readonly errorCode: IpcErrorCode | null
  /** The session's name, on one line, or `null` when there is no tree. */
  readonly label: string | null
  /** The session's tokens as its card on the desktop shows them: the team's roll-up for a lead with a team. `null` when there is no figure. */
  readonly totalTokens: number | null
  /** Whether `totalTokens` leaves something out. */
  readonly totalTokensPartial: boolean
  /** The tree, or `null` when `status` isn't `ready`. */
  readonly root: PaneNode | null
  /** When the view was built, in milliseconds since the epoch. */
  readonly refreshedAtMs: number
}
