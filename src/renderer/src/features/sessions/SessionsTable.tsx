import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SessionsTable.module.css'
import { SessionTableRow } from './SessionTableRow'
import type { SessionRow } from './sessionRow'
import { useSessionsViewStore } from './state/useSessionsViewStore'
import { visibleRows } from './visibleRows'

const COLUMNS = [
  'session',
  'lastActive',
  'duration',
  'model',
  'agents',
  'sessionUsage',
  'teamUsage'
] as const

/** Props for {@link SessionsTable}. */
interface SessionsTableProps {
  /** The top-level rows to show, already filtered. */
  readonly rows: readonly SessionRow[]
  /** The id of the heading that names the table. */
  readonly labelledBy: string
  /** The folder the list is for. */
  readonly selectedDirName: string
  /** Whether a search is active. */
  readonly searching: boolean
}

/**
 * The sessions table. A lead with teammates has a disclosure button that
 * shows them as nested rows, and a search shows matching teammates directly.
 * It scrolls sideways when the window is narrower than the table. It is
 * memoized so a keystroke in the search box skips it until the deferred
 * filter catches up.
 *
 * @example
 * <SessionsTable rows={rows} labelledBy={headingId} selectedDirName="-Users-me-repo" searching={false} />
 */
export const SessionsTable = memo(function SessionsTable({
  rows,
  labelledBy,
  selectedDirName,
  searching
}: SessionsTableProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const expanded = useSessionsViewStore((state) => state.expanded)
  const shown = useMemo(
    () => visibleRows({ rows, expanded, searching }),
    [rows, expanded, searching]
  )

  return (
    <div className={styles.scroller} role="region" aria-label={t('table')}>
      <table className={styles.table} aria-labelledby={labelledBy}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={styles.heading}>
                {t(`columns.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((visible) => (
            <SessionTableRow
              key={visible.row.key}
              visible={visible}
              selectedDirName={selectedDirName}
              searching={searching}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
})
