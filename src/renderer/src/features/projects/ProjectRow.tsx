import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import styles from './ProjectRow.module.css'

/** Props for {@link ProjectRow}. */
interface ProjectRowProps {
  /** The mark before the label, such as a {@link ProjectDot}. Decorative. */
  readonly dot: React.ReactNode
  /** The row's text. It may come from a transcript, so it renders as plain text. */
  readonly label: string
  /**
   * A fuller name, such as the folder name, read by screen readers as the
   * row's description and never shown. It tells apart rows whose labels match.
   */
  readonly detail?: string
  /** A muted note on the right, such as a token total. */
  readonly meta?: React.ReactNode
  /** Whether the row is the current page. */
  readonly current: boolean
  /**
   * Whether the current page is one of the project's worktrees, which are out
   * of view. The row looks current and says so in its name, but is not the page.
   * @defaultValue false
   */
  readonly holdsCurrent?: boolean
  /**
   * Whether the row sits indented beneath another.
   * @defaultValue false
   */
  readonly nested?: boolean
  /** Called when the row is pressed. */
  readonly onSelect: () => void
}

/**
 * One row of the sidebar's project list: a button with a mark, a label that
 * shows in full on hover and focus, and an optional note. The caller supplies
 * the list item around it.
 *
 * @example
 * <ProjectRow dot={<ProjectDot variant="solid" slot={1} />} label="acme-web" detail={dirName} current onSelect={() => select(dirName)} />
 */
export function ProjectRow({
  dot,
  label,
  detail,
  meta,
  current,
  holdsCurrent = false,
  nested = false,
  onSelect
}: ProjectRowProps): React.JSX.Element {
  const { t } = useTranslation('projects')
  const detailId = useId()
  const className = [styles.row, nested && styles.nested, holdsCurrent && styles.holdsCurrent]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      aria-describedby={detail === undefined ? undefined : detailId}
      aria-current={current ? 'page' : undefined}
      onClick={onSelect}
    >
      <span className={styles.main}>
        {dot}
        <span className={styles.label}>{label}</span>
      </span>
      {holdsCurrent && (
        <>
          {/* The space keeps the label and this note apart in the accessible name. */}{' '}
          <span className="visuallyHidden">{t('list.holdsCurrent')}</span>
        </>
      )}
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
  )
}
