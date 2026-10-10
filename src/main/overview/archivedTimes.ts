import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'

/**
 * The times an archived list item holds, which the windows judge it by.
 *
 * @param item - The archived list item.
 * @returns When its last message was and when its transcript was last written, either `null` when unknown.
 */
export function archivedTimesOf(item: SessionListItemDto): {
  readonly latestMs: number | null
  readonly modifiedMs: number | null
} {
  return {
    latestMs: item.summary.ok ? (item.summary.value.activity?.latestMs ?? null) : null,
    modifiedMs: item.modifiedMs
  }
}
