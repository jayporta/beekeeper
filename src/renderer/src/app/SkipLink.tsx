import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SkipLink.module.css'

/** Props for {@link SkipLink}. */
interface SkipLinkProps {
  /** The element to focus, which needs `tabIndex={-1}`. */
  readonly target: RefObject<HTMLElement | null>
}

/**
 * A link that jumps past the sidebar to the main content. It sits off screen
 * until it takes keyboard focus. It moves focus itself instead of following
 * its `#` address, so the page address never changes.
 *
 * @example
 * <SkipLink target={mainRef} />
 */
export function SkipLink({ target }: SkipLinkProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <a
      href="#main"
      className={styles.link}
      onClick={(event) => {
        event.preventDefault()
        target.current?.focus()
      }}
    >
      {t('skipToMain')}
    </a>
  )
}
