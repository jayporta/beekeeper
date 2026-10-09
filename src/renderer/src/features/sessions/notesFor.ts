import { archivedNote, folderNote, stoppedNote } from './itemNotes'
import { limitHitNote } from './limitHitNote'
import type { SessionRow } from './sessionRow'
import { signalNotes, signalTotalsOf } from './signalNotes'
import type { SessionsT } from './sessionsT'

/** What {@link notesFor} needs besides the row. */
export interface NotesOptions {
  /** The folder the list is for, to mark sessions from another folder. */
  readonly selectedDirName: string
  /** The time to compare a limit's reset against, in milliseconds since the Unix epoch. */
  readonly nowMs: number
  /** The sessions translate function. */
  readonly t: SessionsT
}

/**
 * The muted notes after a session's name: whether it is archived, its team,
 * stopped state, plan limit hit, signal counts, and folders.
 *
 * @param row - The session's row.
 * @param options - The list's folder, the current time, and the translate function.
 * @returns The notes, in the order they are shown.
 */
export function notesFor(row: SessionRow, { selectedDirName, nowMs, t }: NotesOptions): string[] {
  const { item, leadFolder } = row
  const notes: string[] = []
  const archived = archivedNote(item, t)
  if (archived !== null) notes.push(archived)
  if (item.team?.kind === 'ungrouped' && item.team.teamName !== null) {
    notes.push(t('notes.team', { name: item.team.teamName }))
  }
  const stopped = stoppedNote(item, t)
  if (stopped !== null) notes.push(stopped)
  const limit = item.summary.ok ? limitHitNote(item.summary.value.limitHit, { nowMs, t }) : null
  if (limit !== null) notes.push(limit)
  notes.push(...signalNotes(signalTotalsOf(item), t))
  if (leadFolder !== null) notes.push(t('notes.leadIn', { folder: leadFolder }))
  const folder = folderNote(item, selectedDirName, t)
  if (folder !== null) notes.push(folder)
  return notes
}
