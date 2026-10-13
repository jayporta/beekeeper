import styles from './InspectorStatGrid.module.css'

/** Props for {@link InspectorStatGrid}. */
interface InspectorStatGridProps {
  /** The grid's items, each a `StatRowItem`. */
  readonly children: React.ReactNode
}

/**
 * The inspector's stat grid: labelled figures in two columns, each under a
 * rule, as a description list of `StatRowItem`s.
 *
 * @example
 * <InspectorStatGrid><StatRowItem label="Tokens">1.2K</StatRowItem></InspectorStatGrid>
 */
export function InspectorStatGrid({ children }: InspectorStatGridProps): React.JSX.Element {
  return <dl className={styles.grid}>{children}</dl>
}
