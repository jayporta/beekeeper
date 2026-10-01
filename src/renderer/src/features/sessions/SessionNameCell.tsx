import { useId } from 'react'
import styles from './SessionNameCell.module.css'
import { rowId } from './rowId'
import { sessionLabel } from './sessionLabel'
import type { SessionRow } from './sessionRow'
import { useSessionsViewStore } from './state/useSessionsViewStore'

/** Props for {@link SessionNameCell}. */
interface SessionNameCellProps {
  /** The row. */
  readonly row: SessionRow
  /** Whether the row is a teammate nested under a lead. */
  readonly nested: boolean
  /** The lead's name, read out before a nested row's name. `null` for a top-level row. */
  readonly leadLabel: string | null
  /** Whether the row shows a disclosure button for its teammates. */
  readonly canExpand: boolean
  /** The folder the list is for, to mark sessions from another folder. */
  readonly selectedDirName: string
}

/** The muted notes after a session's name: its team, stopped state, and folders. */
function notesFor(row: SessionRow, selectedDirName: string): string[] {
  const { item, leadFolder } = row
  const notes: string[] = []
  if (item.team?.kind === 'ungrouped' && item.team.teamName !== null) {
    notes.push(`team ${item.team.teamName}`)
  }
  if (item.team?.kind === 'teammate' && item.team.stopped) notes.push('stopped')
  if (leadFolder !== null) notes.push(`lead in ${leadFolder}`)
  if (item.projectDirName !== selectedDirName) notes.push(`in ${item.projectDirName}`)
  return notes
}

/**
 * The first cell of a session row: its name as plain text, a short id beside a
 * placeholder name, muted notes, and for a lead with teammates a disclosure
 * button that shows or hides them.
 *
 * @example
 * <SessionNameCell row={row} nested={false} leadLabel={null} canExpand selectedDirName="-Users-me-repo" />
 */
export function SessionNameCell({
  row,
  nested,
  leadLabel,
  canExpand,
  selectedDirName
}: SessionNameCellProps): React.JSX.Element {
  const expanded = useSessionsViewStore((state) => state.expanded.has(row.key))
  const toggle = useSessionsViewStore((state) => state.toggle)
  const { text, idHint } = sessionLabel(row.item)
  const count = row.teammates.length
  const textId = useId()
  const leadId = useId()
  const idHintId = useId()
  // Names the row by its session, who it belongs to and its id hint only, so the
  // button and notes are not repeated in the name of every cell that reads this header.
  const nameIds = [
    textId,
    ...(leadLabel === null ? [] : [leadId]),
    ...(idHint === null ? [] : [idHintId])
  ]

  return (
    <th
      scope="row"
      aria-labelledby={nameIds.join(' ')}
      className={nested ? styles.nested : styles.name}
    >
      <div className={styles.content}>
        {canExpand && (
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={expanded}
            aria-controls={row.teammates.map((teammate) => rowId(teammate.key)).join(' ')}
            aria-label={`${count} ${count === 1 ? 'teammate' : 'teammates'} of ${text}`}
            onClick={() => {
              toggle(row.key)
            }}
          >
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          </button>
        )}
        <span id={textId} className={styles.text}>
          {text}
        </span>
        {leadLabel !== null && (
          <span id={leadId} className="visuallyHidden">
            teammate of {leadLabel}
          </span>
        )}
        {idHint !== null && (
          <span id={idHintId} className={styles.note}>
            {idHint}
          </span>
        )}
        {notesFor(row, selectedDirName).map((note) => (
          <span key={note} className={styles.note}>
            {note}
          </span>
        ))}
      </div>
    </th>
  )
}
