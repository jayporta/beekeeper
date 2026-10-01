import { useTranslation } from 'react-i18next'

/** Props for {@link RetryButton}. */
interface RetryButtonProps {
  /** Runs the retry. */
  readonly onRetry: () => void
}

/**
 * A "Retry" button for an error state. A retry replaces the error with a
 * loading state, which would drop the focused button and send focus to the
 * page body, so a click moves focus to the enclosing `<main>` first.
 *
 * @example
 * <RetryButton onRetry={() => void refetch()} />
 */
export function RetryButton({ onRetry }: RetryButtonProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={(event) => {
        event.currentTarget.closest('main')?.focus()
        onRetry()
      }}
    >
      {t('retry')}
    </button>
  )
}
