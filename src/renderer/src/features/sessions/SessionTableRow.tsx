import { EmptyCell } from './EmptyCell'
import { formatDuration } from './formatDuration'
import { formatLastActive } from './formatLastActive'
import { formatUsd } from './formatUsd'
import { lastActiveMs } from './lastActiveMs'
import { rowId } from './rowId'
import { SessionNameCell } from './SessionNameCell'
import styles from './SessionTableRow.module.css'
import { sessionCosts } from './sessionCosts'
import { ValueCell } from './ValueCell'
import type { VisibleRow } from './visibleRows'

/** Props for {@link SessionTableRow}. */
interface SessionTableRowProps {
  /** The row and whether it is nested. */
  readonly visible: VisibleRow
  /** The folder the list is for. */
  readonly selectedDirName: string
  /** Whether a search is active, which shows teammates without a disclosure button. */
  readonly searching: boolean
}

/**
 * One row of the sessions table: name, last active, duration, model, teammate
 * count, lead cost, and team cost. A session whose summary couldn't be read
 * shows empty cells.
 *
 * @example
 * <SessionTableRow visible={visible} selectedDirName="-Users-me-repo" searching={false} />
 */
export function SessionTableRow({
  visible,
  selectedDirName,
  searching
}: SessionTableRowProps): React.JSX.Element {
  const { row, nested } = visible
  const { item } = row
  const summary = item.summary.ok ? item.summary.value : null
  const costs = sessionCosts(item)
  const teammateCount =
    item.team?.kind === 'lead'
      ? item.team.teammates.length
      : summary?.role.kind === 'lead' && item.team === null
        ? 0
        : null

  return (
    <tr id={nested ? rowId(row.key) : undefined} className={nested ? styles.nested : undefined}>
      <SessionNameCell
        row={row}
        nested={nested}
        canExpand={!nested && !searching && row.teammates.length > 0}
        selectedDirName={selectedDirName}
      />
      <ValueCell value={formatLastActive(lastActiveMs(item))} />
      <ValueCell value={formatDuration(summary?.activity ?? null)} numeric />
      <ValueCell value={summary?.model ?? null} />
      <ValueCell value={teammateCount === null ? null : String(teammateCount)} numeric />
      <ValueCell value={formatUsd(costs.leadUSD)} numeric />
      {item.team?.kind === 'lead' ? (
        <ValueCell
          value={formatUsd(costs.teamUSD)}
          numeric
          {...(costs.partial && { note: 'partial' })}
        />
      ) : (
        <td className={styles.empty}>
          <EmptyCell />
        </td>
      )}
    </tr>
  )
}
