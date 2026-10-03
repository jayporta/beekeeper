import { useTranslation } from 'react-i18next'
import styles from './Breadcrumb.module.css'

/** One step in a {@link Breadcrumb}. */
export interface BreadcrumbSegment {
  /** The step's text. It may come from a transcript, so it renders as plain text. */
  readonly label: string
  /** Navigates to this step. A step without it renders as plain text, never as a button. */
  readonly onSelect?: () => void
}

/** Props for {@link Breadcrumb}. */
interface BreadcrumbProps {
  /** The path to the current page, outermost first. The last segment is the current page. */
  readonly segments: readonly BreadcrumbSegment[]
}

/**
 * The path to the current page. Earlier steps with an `onSelect` are buttons
 * that navigate up. The last step is plain text marked as the current page.
 *
 * @example
 * <Breadcrumb segments={[{ label: 'Sessions', onSelect: showSessions }, { label: title }]} />
 */
export function Breadcrumb({ segments }: BreadcrumbProps): React.JSX.Element {
  const { t } = useTranslation('navigation')
  const lastIndex = segments.length - 1

  return (
    <nav aria-label={t('breadcrumb.label')}>
      <ol className={styles.trail}>
        {segments.map(({ label, onSelect }, index) => (
          <li key={`${index}:${label}`}>
            {index === lastIndex ? (
              <span className={styles.current} aria-current="page">
                {label}
              </span>
            ) : onSelect === undefined ? (
              label
            ) : (
              <button type="button" className={styles.link} onClick={onSelect}>
                {label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
