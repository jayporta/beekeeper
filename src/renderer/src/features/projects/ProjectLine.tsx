import styles from './ProjectLine.module.css'

/** Props for {@link ProjectLine}. */
interface ProjectLineProps {
  /** The worktree toggle. Without one, a space of the same width keeps the rows aligned. */
  readonly toggle?: React.ReactNode
  /** The row. */
  readonly children: React.ReactNode
}

/**
 * One line of the sidebar's project list: a worktree toggle, or a space where
 * it would be, then the row.
 *
 * @example
 * <ProjectLine toggle={<WorktreeToggle {...props} />}><ProjectRow {...rowProps} /></ProjectLine>
 */
export function ProjectLine({ toggle, children }: ProjectLineProps): React.JSX.Element {
  return (
    <div className={toggle === undefined ? `${styles.line} ${styles.spaced}` : styles.line}>
      {toggle}
      {children}
    </div>
  )
}
