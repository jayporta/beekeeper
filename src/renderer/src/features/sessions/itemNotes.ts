import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import type { SessionsT } from './sessionsT'

/**
 * The note for a session whose transcript is no longer on disk.
 *
 * @param item - A session list item.
 * @param t - The sessions translate function.
 * @returns "archived", or `null` when the session is read from disk.
 */
export function archivedNote(item: SessionListItemDto, t: SessionsT): string | null {
  return item.archived ? t('notes.archived') : null
}

/**
 * The note for a teammate session its lead stopped.
 *
 * @param item - A session list item.
 * @param t - The sessions translate function.
 * @returns "stopped", or `null` when the session is not a stopped teammate.
 */
export function stoppedNote(item: SessionListItemDto, t: SessionsT): string | null {
  return item.team?.kind === 'teammate' && item.team.stopped ? t('notes.stopped') : null
}

/**
 * The note for a session that lives in another folder than the list's.
 *
 * @param item - A session list item.
 * @param selectedDirName - The folder the list is for.
 * @param t - The sessions translate function.
 * @returns "in <folder>", or `null` when the session is in the list's folder.
 */
export function folderNote(
  item: SessionListItemDto,
  selectedDirName: string,
  t: SessionsT
): string | null {
  return item.projectDirName === selectedDirName
    ? null
    : t('notes.in', { folder: item.projectDirName })
}
