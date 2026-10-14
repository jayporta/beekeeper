import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'

/** Which agent's changes to which file to show. */
export interface FileDiffTarget {
  /** The session that holds the agent. */
  readonly ref: SessionRefDto
  /** The subagent's id, or `null` for the session's own agent. */
  readonly agentId: string | null
  /** The file's path as the Files touched list shows it. Untrusted text. */
  readonly filePath: string
}
