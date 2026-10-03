import { useTranslation } from 'react-i18next'
import { notesFor } from './notesFor'
import styles from './SessionNameCell.module.css'
import { rowId } from './rowId'
import type { SessionRow } from './sessionRow'
import { useSessionsViewStore } from './state/useSessionsViewStore'
import { useNowUntil } from './useNowUntil'

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
  const { summary } = row.item
  const nowMs = useNowUntil(summary.ok ? (summary.value.limitHit?.resetsAtMs ?? null) : null)
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
        {notesFor(row, { selectedDirName, nowMs, t }).map((note) => (
          <span key={note} className={styles.note}>
            {note}
          </span>
        ))}
      </div>
    </th>
  )
}
