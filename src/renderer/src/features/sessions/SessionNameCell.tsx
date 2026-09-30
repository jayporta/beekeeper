import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
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
  /** Whether the row shows a disclosure button for its teammates. */
  readonly canExpand: boolean
  /** The folder the list is for, to mark sessions from another folder. */
  readonly selectedDirName: string
}

/** The muted notes after a session's name: its team, stopped state, and folders. */
function notesFor(
  item: SessionListItemDto,
  leadFolder: string | null,
  selectedDirName: string
): string[] {
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
 * <SessionNameCell row={row} nested={false} canExpand selectedDirName="-Users-me-repo" />
 */
export function SessionNameCell({
  row,
  nested,
  canExpand,
  selectedDirName
}: SessionNameCellProps): React.JSX.Element {
  const expanded = useSessionsViewStore((state) => state.expanded.has(row.key))
  const toggle = useSessionsViewStore((state) => state.toggle)
  const { text, idHint } = sessionLabel(row.item)
  const count = row.teammates.length

  return (
    <th scope="row" className={nested ? styles.nested : styles.name}>
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
        <span className={styles.text}>{text}</span>
        {idHint !== null && <span className={styles.note}>{idHint}</span>}
        {notesFor(row.item, row.leadFolder, selectedDirName).map((note) => (
          <span key={note} className={styles.note}>
            {note}
          </span>
        ))}
      </div>
    </th>
  )
}
