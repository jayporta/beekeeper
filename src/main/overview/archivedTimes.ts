import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'

/** The times an archived list item holds, which the windows judge it by. */
export interface ArchivedTimes {
  /** When its last message was, in epoch milliseconds, or `null` when unknown. */
  readonly latestMs: number | null
  /** When its transcript was last written, in epoch milliseconds, or `null` when unknown. */
  readonly modifiedMs: number | null
}

/**
 * Reads the times an archived list item holds.
 *
 * @param item - The archived list item.
 * @returns When its last message was and when its transcript was last written.
 */
export function archivedTimesOf(item: SessionListItemDto): ArchivedTimes {
  return {
    latestMs: item.summary.ok ? (item.summary.value.activity?.latestMs ?? null) : null,
    modifiedMs: item.modifiedMs
  }
}
