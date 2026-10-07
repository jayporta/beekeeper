import styles from './CardColumns.module.css'

/** Props for {@link CardColumns}. */
interface CardColumnsProps {
  /** The row's cells: the title, agents, duration, and tokens, in that order. */
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
 * One row of the session list's columns, shared by a card and the header above
 * the cards so they line up. Below the list's stacking width the row wraps and
 * its first cell takes a line of its own.
 *
 * @example
 * <CardColumns className={styles.header} decorative>
 *   <span>Session</span>
 *   <span>Agents</span>
 *   <span>Duration</span>
 *   <span>Tokens</span>
 * </CardColumns>
 */
export function CardColumns({
  children,
  className,
  decorative = false
}: CardColumnsProps): React.JSX.Element {
  return (
    <div
      className={className === undefined ? styles.columns : `${styles.columns} ${className}`}
      aria-hidden={decorative || undefined}
    >
      {children}
    </div>
  )
}
