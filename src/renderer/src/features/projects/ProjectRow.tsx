import styles from './ProjectRow.module.css'

/** Props for {@link ProjectRow}. */
interface ProjectRowProps {
  /** The row's text. It may come from a transcript, so it renders as plain text. */
  readonly label: string
  /** Shown on hover, for a label that is cut short or stands in for a longer name. */
  readonly title?: string
  /** A muted note on the right, such as `worktree`. */
  readonly meta?: string
  /** Whether the row is the current page. */
  readonly current: boolean
  /**
   * Whether the row sits indented beneath another, with a leading arrow.
   * @defaultValue false
   */
  readonly nested?: boolean
  /** Called when the row is pressed. */
  readonly onSelect: () => void
}

/**
 * One row of the sidebar's project list: a button on a single line that
 * ends in an ellipsis when its label is too long.
 *
 * @example
 * <ProjectRow label="acme-web" title={dirName} current onSelect={() => select(dirName)} />
 */
export function ProjectRow({
  label,
  title,
  meta,
  current,
  nested = false,
  onSelect
}: ProjectRowProps): React.JSX.Element {
  return (
    <li className={nested ? `${styles.item} ${styles.nested}` : styles.item}>
      <button
        type="button"
        className={styles.row}
        title={title}
        aria-current={current ? 'page' : undefined}
        onClick={onSelect}
      >
        <span className={styles.label}>{label}</span>
        {meta !== undefined && (
          <>
            {/* The space keeps the label and note apart in the accessible name. */}{' '}
            <span className={styles.meta}>{meta}</span>
          </>
        )}
      </button>
    </li>
  )
}
