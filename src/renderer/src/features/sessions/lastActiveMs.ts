import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/**
 * When a session was last active: the newest record timestamp in its
 * transcript, else the file's modified time.
 *
 * @param item - A session list item.
 * @returns Milliseconds since the Unix epoch, or `null` when neither is known.
 */
export function lastActiveMs(item: SessionListItemDto): number | null {
  if (item.summary.ok && item.summary.value.activity !== null) {
    return item.summary.value.activity.latestMs
  }
  return item.modifiedMs
}
