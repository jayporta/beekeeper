import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** One row of the sessions table, with the teammates nested under it. */
export interface SessionRow {
  /** The session's key across folders, from `sessionKey`. */
  readonly key: string
  /** The session as listed. */
  readonly item: SessionListItemDto
  /** Teammates shown under this lead, in the lead's order. Empty for any other row. */
  readonly teammates: readonly SessionRow[]
  /**
   * For a top-level teammate whose lead is not in this list, the lead's folder
   * name. `null` for every other row.
   */
  readonly leadFolder: string | null
}
