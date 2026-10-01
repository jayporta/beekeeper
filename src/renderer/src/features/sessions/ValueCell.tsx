import { EmptyCell, type EmptyReason } from './EmptyCell'
import styles from './ValueCell.module.css'

/** Props for {@link ValueCell}. */
interface ValueCellProps {
  /** The text to show, or `null` for an empty cell. */
  readonly value: string | null
  /**
   * Right-aligns the value, for a number or an amount.
   * @defaultValue false
   */
  readonly numeric?: boolean
  /** A muted note after the value, such as "partial". */
  readonly note?: string
  /**
   * Why the cell is empty, when `value` is `null`.
   * @defaultValue 'not-recorded'
   */
  readonly emptyReason?: EmptyReason
}

/**
 * A table data cell holding one value, an empty marker when there is none,
 * and an optional muted note.
 *
 * @example
 * <ValueCell value="$1.20" numeric note="partial" />
 */
export function ValueCell({
  value,
  numeric = false,
  note,
  emptyReason
}: ValueCellProps): React.JSX.Element {
  return (
    <td className={numeric ? styles.numeric : styles.cell}>
      {value === null ? (
        <EmptyCell {...(emptyReason !== undefined && { reason: emptyReason })} />
      ) : (
        value
      )}
      {note !== undefined && <span className={styles.note}>{note}</span>}
    </td>
  )
}
