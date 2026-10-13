import { withClassName } from '@renderer/components/withClassName'
import styles from './SummaryAgentRow.module.css'

/** Props for {@link SummaryAgentRow}. */
interface SummaryAgentRowProps {
  /** The agent's name. Transcript-derived: rendered as plain text. */
  readonly name: string
  /** The row's other cells, after the name. */
  readonly children: React.ReactNode
  /** Called when the row is pressed. */
  readonly onPress: () => void
  /** A class that sets the row's grid columns. */
  readonly className: string | undefined
}

/**
 * A summary card's row for one agent: a whole-row button that selects the
 * agent in the graph. The name comes first, cut with an ellipsis when long,
 * then the cells the card gives it. The button's name is its text, so it
 * carries every figure it shows.
 *
 * @example
 * <SummaryAgentRow name="scout" onPress={select} className={styles.columns}><span>12</span></SummaryAgentRow>
 */
export function SummaryAgentRow({
  name,
  children,
  onPress,
  className
}: SummaryAgentRowProps): React.JSX.Element {
  return (
    <li className={styles.item}>
      <button type="button" className={withClassName(styles.row, className)} onClick={onPress}>
        <span className={styles.name}>
          <bdi>{name}</bdi>
        </span>
        {children}
      </button>
    </li>
  )
}
