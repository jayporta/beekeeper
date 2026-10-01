import { EmptyCell } from './EmptyCell'
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
}

/**
 * A table data cell holding one value, or an empty marker when there is none.
 *
 * @example
 * <ValueCell value="1h 5m" numeric />
 */
export function ValueCell({ value, numeric = false }: ValueCellProps): React.JSX.Element {
  return <td className={numeric ? styles.numeric : styles.cell}>{value ?? <EmptyCell />}</td>
}
