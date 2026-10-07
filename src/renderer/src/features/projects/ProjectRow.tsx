import { useId } from 'react'
import { MutedText } from '@renderer/components/MutedText'
import styles from './ProjectRow.module.css'

/** Props for {@link ProjectRow}. */
interface ProjectRowProps {
  /** The row's text. It may come from a transcript, so it renders as plain text. */
  readonly label: string
  /**
   * A fuller name, such as the folder name, read by screen readers as the
   * row's description and never shown. It tells apart rows whose labels match.
   */
  readonly detail?: string
  /** A muted note on the right, such as `worktree` or a token total. */
  readonly meta?: React.ReactNode
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
 * One row of the sidebar's project list: a button whose label wraps onto
 * more lines when it is too long, beside an optional note.
 *
 * @example
 * <ProjectRow label="acme-web" detail={dirName} current onSelect={() => select(dirName)} />
 */
export function ProjectRow({
  label,
  detail,
  meta,
  current,
  nested = false,
  onSelect
}: ProjectRowProps): React.JSX.Element {
  const detailId = useId()

  return (
    <li className={nested ? `${styles.item} ${styles.nested}` : styles.item}>
      <button
        type="button"
        className={styles.row}
        aria-describedby={detail === undefined ? undefined : detailId}
        aria-current={current ? 'page' : undefined}
        onClick={onSelect}
      >
        <span className={styles.label}>{label}</span>
        {meta !== undefined && (
          <>
            {/* The space keeps the label and note apart in the accessible name. */}{' '}
            <MutedText as="span" className={styles.meta}>
              {meta}
            </MutedText>
          </>
        )}
        {/* Hidden from view and the name; aria-describedby still exposes it as the description. */}
        {detail !== undefined && (
          <span id={detailId} className="visuallyHidden" aria-hidden="true">
            {detail}
          </span>
        )}
      </button>
    </li>
  )
}
