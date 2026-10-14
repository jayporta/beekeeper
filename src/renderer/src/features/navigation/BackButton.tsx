import { useTranslation } from 'react-i18next'
import styles from './BackButton.module.css'

/** Props for {@link BackButton}. */
interface BackButtonProps {
  /** Whether there is a place to go back to. When not, the button is unavailable. */
  readonly canGoBack: boolean
  /** Goes back. It is not called while `canGoBack` is `false`. */
  readonly onBack: () => void
}

/**
 * The "Back" button, with a chevron before its text. With nowhere to go back to
 * it is marked `aria-disabled` and ignores presses, rather than using
 * `disabled`, which would drop it from the tab order and send focus to the page
 * body when the last place is gone. It never moves focus itself: going back is
 * a navigation, which moves focus to the main area.
 *
 * @example
 * <BackButton canGoBack={history.length > 0} onBack={goBack} />
 */
export function BackButton({ canGoBack, onBack }: BackButtonProps): React.JSX.Element {
  const { t } = useTranslation('navigation')

  return (
    <button
      type="button"
      className={styles.button}
      aria-disabled={!canGoBack}
      onClick={() => {
        if (canGoBack) onBack()
      }}
    >
      <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
      {t('back.label')}
    </button>
  )
}
