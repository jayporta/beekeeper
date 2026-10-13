import { PartialMarker } from '@renderer/components/PartialMarker'
import styles from './ProjectStats.module.css'

/** Props for {@link ProjectStatsItem}. */
interface ProjectStatsItemProps {
  /** What the figure is. */
  readonly label: string
  /** The figure, as text. */
  readonly children: React.ReactNode
  /**
   * The spoken note that sends the reader to the footnote, when the figure may be low.
   * @defaultValue No marker.
   */
  readonly partialNote?: string
}

/**
 * One label and figure of the stat row. A partial figure carries the marker
 * that points at the row's footnote.
 *
 * @example
 * <dl><ProjectStatsItem label="Sessions">12</ProjectStatsItem></dl>
 */
export function ProjectStatsItem({
  label,
  children,
  partialNote
}: ProjectStatsItemProps): React.JSX.Element {
  return (
    <div className={styles.item}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        {children}
        {partialNote !== undefined && <PartialMarker note={partialNote} />}
      </dd>
    </div>
  )
}
