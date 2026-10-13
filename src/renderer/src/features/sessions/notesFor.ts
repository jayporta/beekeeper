import { archivedNote, folderNote, stoppedNote } from './itemNotes'
import { limitHitNote } from './limitHitNote'
import type { SessionRow } from './sessionRow'
import { signalPills, signalsMarked, signalTotalsOf, type PillTone } from './signalNotes'
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

/** One status of a session, shown as a pill. */
export interface RowPill {
  /** The pill's text. */
  readonly text: string
  /** The pill's tone. */
  readonly tone: PillTone
  /** Whether the signals partial marker follows this pill: it is the last signal count of a partial set. */
  readonly signalsMarker: boolean
}

/** The notes after a session's name. */
export interface RowNotes {
  /** Statuses that stand out, in the order they are shown. */
  readonly pills: readonly RowPill[]
  /** Plain muted notes, in the order they are shown. */
  readonly meta: readonly string[]
}

/**
 * The notes after a session's name. Whether it is archived or stopped, the
 * plan limit it hit, and its signal counts are pills. Its team and the
 * folders involved stay plain muted text.
 *
 * @param row - The session's row.
 * @param options - The list's folder, the current time, and the translate function.
 * @returns The pills and the muted notes, each in the order they are shown.
 */
export function notesFor(row: SessionRow, { selectedDirName, nowMs, t }: NotesOptions): RowNotes {
  const { item, leadFolder } = row
  const pills: RowPill[] = []
  const pill = (text: string | null, tone: PillTone): void => {
    if (text !== null) pills.push({ text, tone, signalsMarker: false })
  }
  pill(archivedNote(item, t), 'neutral')
  pill(stoppedNote(item, t), 'neutral')
  pill(item.summary.ok ? limitHitNote(item.summary.value.limitHit, { nowMs, t }) : null, 'warning')

  const signals = signalTotalsOf(item)
  const marked = signalsMarked(signals)
  const signalPillList = signalPills(signals, t)
  signalPillList.forEach((signal, index) => {
    pills.push({
      text: signal.text,
      tone: signal.tone,
      signalsMarker: marked && index === signalPillList.length - 1
    })
  })

  const meta: string[] = []
  if (item.team?.kind === 'ungrouped' && item.team.teamName !== null) {
    meta.push(t('notes.team', { name: item.team.teamName }))
  }
  if (leadFolder !== null) meta.push(t('notes.leadIn', { folder: leadFolder }))
  const folder = folderNote(item, selectedDirName, t)
  if (folder !== null) meta.push(folder)
  return { pills, meta }
}
