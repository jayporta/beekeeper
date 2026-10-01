import { agentCountLabel } from './agentCountLabel'
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
 * One row of the sessions table: name, last active, duration, model, agents,
 * lead cost, and team cost. A session whose summary couldn't be read shows a
 * placeholder name, its file's last-modified time, and empty value cells for
 * everything that comes from the summary.
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
  return (
    <tr id={nested ? rowId(row.key) : undefined} className={nested ? styles.nested : undefined}>
      <SessionNameCell
        row={row}
        nested={nested}
        leadLabel={visible.leadLabel}
        canExpand={!nested && !searching && row.teammates.length > 0}
        selectedDirName={selectedDirName}
      />
      <ValueCell value={formatLastActive(lastActiveMs(item))} />
      <ValueCell value={formatDuration(summary?.activity ?? null)} numeric />
      <ValueCell value={summary?.model ?? null} />
      <ValueCell value={agentCountLabel(item)} />
      <ValueCell value={formatUsd(costs.leadUSD)} numeric />
      {item.team?.kind === 'lead' ? (
        <ValueCell
          value={formatUsd(costs.teamUSD)}
          numeric
          {...(costs.partial && { note: 'partial' })}
        />
      ) : (
        <ValueCell
          value={null}
          numeric
          emptyReason={summary === null ? 'not-recorded' : 'not-applicable'}
        />
      )}
    </tr>
  )
}
