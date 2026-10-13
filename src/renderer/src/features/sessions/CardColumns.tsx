import { withClassName } from '@renderer/components/withClassName'
import styles from './CardColumns.module.css'

/** Props for {@link CardColumns}. */
interface CardColumnsProps {
  /** The row's cells: the title, agents, duration, bar, tokens, and API price, in that order. */
  readonly children: React.ReactNode
  /**
   * A class that adds to the row's own rules, such as its vertical padding.
   * @defaultValue No extra class.
   */
  readonly className?: string
  /**
   * Hides the row from assistive technology, for a row that is visual only.
   * @defaultValue false
   */
  readonly decorative?: boolean
}

/**
 * One row of the session list's columns, shared by a row and the header above
 * the rows so they line up.
 *
 * @example
 * <CardColumns className={styles.header} decorative>
 *   <span>Session</span>
 *   <span>Agents</span>
 *   <span>Duration</span>
 *   <span></span>
 *   <span>Tokens</span>
 *   <span>API price</span>
 * </CardColumns>
 */
export function CardColumns({
  children,
  className,
  decorative = false
}: CardColumnsProps): React.JSX.Element {
  return (
    <div className={withClassName(styles.columns, className)} aria-hidden={decorative || undefined}>
      {children}
    </div>
  )
}
