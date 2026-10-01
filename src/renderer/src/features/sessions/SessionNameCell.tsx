import { useTranslation } from 'react-i18next'
import styles from './SessionNameCell.module.css'
import { rowId } from './rowId'
import type { SessionRow } from './sessionRow'
import type { SessionsT } from './sessionsT'
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

/** What {@link notesFor} needs besides the row. */
interface NotesOptions {
  /** The folder the list is for, to mark sessions from another folder. */
  readonly selectedDirName: string
  /** The sessions translate function. */
  readonly t: SessionsT
}

/** The muted notes after a session's name: its team, stopped state, and folders. */
function notesFor(row: SessionRow, { selectedDirName, t }: NotesOptions): string[] {
  const { item, leadFolder } = row
  const notes: string[] = []
  if (item.team?.kind === 'ungrouped' && item.team.teamName !== null) {
    notes.push(t('notes.team', { name: item.team.teamName }))
  }
  if (item.team?.kind === 'teammate' && item.team.stopped) notes.push(t('notes.stopped'))
  if (leadFolder !== null) notes.push(t('notes.leadIn', { folder: leadFolder }))
  if (item.projectDirName !== selectedDirName) {
    notes.push(t('notes.in', { folder: item.projectDirName }))
  }
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
  const { t } = useTranslation('sessions')
  const { text, idHint } = row.label
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
            aria-label={t('disclosure', { count, name: text })}
            onClick={() => {
              toggle(row.key)
            }}
          >
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          </button>
        )}
        <span className={styles.text}>{text}</span>
        {leadLabel !== null && (
          <span className="visuallyHidden">{t('teammateOf', { lead: leadLabel })}</span>
        )}
        {idHint !== null && <span className={styles.note}>{idHint}</span>}
        {notesFor(row, { selectedDirName, t }).map((note) => (
          <span key={note} className={styles.note}>
            {note}
          </span>
        ))}
      </div>
    </th>
  )
}
