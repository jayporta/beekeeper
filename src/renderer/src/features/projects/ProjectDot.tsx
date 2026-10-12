import styles from './ProjectDot.module.css'
import { projectColorClass } from './projectColorClass'
import type { ProjectColorSlot } from './projectColorSlot'

/** Props for {@link ProjectDot}: a slot-colored dot or ring, or the all-projects square. */
type ProjectDotProps =
  | {
      /** A filled dot for a top-level project, or a hollow ring for a worktree. */
      readonly variant: 'solid' | 'ring'
      /** The project's color slot. */
      readonly slot: ProjectColorSlot
    }
  | {
      /** The four-color square for "All projects". */
      readonly variant: 'all'
    }

/**
 * A 9px mark beside a sidebar row's label. It is decorative: the row's text
 * names the project, so assistive technology skips it.
 *
 * @example
 * <ProjectDot variant="solid" slot={2} />
 */
export function ProjectDot(props: ProjectDotProps): React.JSX.Element {
  const className = [
    styles.dot,
    styles[props.variant],
    props.variant === 'all' ? undefined : projectColorClass(props.slot)
  ]
    .filter(Boolean)
    .join(' ')

  return <span aria-hidden="true" className={className} />
}
