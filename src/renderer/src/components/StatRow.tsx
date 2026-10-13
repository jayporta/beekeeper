import styles from './StatRow.module.css'

/** Props for {@link StatRow}. */
interface StatRowProps {
  /** The row's items, each a {@link StatRowItem}. */
  readonly children: React.ReactNode
  /**
   * Puts each label beside its figure under a rule of its own, instead of
   * above it under one rule across the row.
   * @defaultValue false
   */
  readonly inline?: boolean
}

/**
 * A row of labelled figures that wraps to fit its width: a description list
 * of {@link StatRowItem}s.
 *
 * @example
 * <StatRow inline>
 *   <StatRowItem label="Tokens">1.2M</StatRowItem>
 * </StatRow>
 */
export function StatRow({ children, inline = false }: StatRowProps): React.JSX.Element {
  return <dl className={`${styles.row} ${inline ? styles.inline : styles.stacked}`}>{children}</dl>
}
