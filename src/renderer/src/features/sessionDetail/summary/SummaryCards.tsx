import styles from './SummaryCards.module.css'

/** Props for {@link SummaryCards}. */
interface SummaryCardsProps {
  /** The cards. */
  readonly children: React.ReactNode
}

/**
 * The row of the session detail's summary cards, which wraps as the window narrows.
 *
 * @example
 * <SummaryCards><BreakdownCard detail={detail} /></SummaryCards>
 */
export function SummaryCards({ children }: SummaryCardsProps): React.JSX.Element {
  return <div className={styles.cards}>{children}</div>
}
