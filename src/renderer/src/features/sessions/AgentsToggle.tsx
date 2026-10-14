import styles from './AgentsToggle.module.css'

/** Props for {@link AgentsToggle}. */
interface AgentsToggleProps {
  /** The agent count text, such as "2 teammates, 1 subagent". */
  readonly children: React.ReactNode
  /** Whether the teammates show. */
  readonly expanded: boolean
  /**
   * The id of the teammate list, set only while it is on the page.
   * @defaultValue None.
   */
  readonly controls?: string
  /** Opens or closes the teammates. */
  readonly onToggle: () => void
}

/**
 * The agent count of a lead's row as a button that shows or hides its
 * teammate rows. It sits above the row's open button, so pressing it does not
 * open the session.
 *
 * @example
 * <AgentsToggle expanded={false} onToggle={toggle}>2 teammates</AgentsToggle>
 */
export function AgentsToggle({
  children,
  expanded,
  controls,
  onToggle
}: AgentsToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <span className={styles.glyph} aria-hidden="true">
        {expanded ? '▾' : '▸'}
      </span>
      {children}
    </button>
  )
}
