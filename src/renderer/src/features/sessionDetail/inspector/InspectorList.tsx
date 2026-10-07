import styles from './InspectorList.module.css'

/** Props for {@link InspectorList}. */
interface InspectorListProps {
  /** The list's items. */
  readonly children: React.ReactNode
  /**
   * A class that adds to the list's own rules, such as how its items align.
   * @defaultValue No extra class.
   */
  readonly className?: string
}

/**
 * An unstyled vertical list in the inspector: no bullets, a small gap between
 * items.
 *
 * @example
 * <InspectorList>
 *   <li>src/index.ts</li>
 * </InspectorList>
 */
export function InspectorList({ children, className }: InspectorListProps): React.JSX.Element {
  return (
    <ul className={className === undefined ? styles.list : `${styles.list} ${className}`}>
      {children}
    </ul>
  )
}
