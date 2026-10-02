import { useTranslation } from 'react-i18next'

/** Props for {@link RefreshButton}. */
interface RefreshButtonProps {
  /** Starts the refresh. */
  readonly onRefresh: () => void
  /** Whether a refresh is running. The button says so and ignores clicks. */
  readonly refreshing: boolean
  /** Whether a refresh has finished, so the status announces it. */
  readonly refreshed: boolean
}

/**
 * A "Refresh" button with a polite status that announces when a refresh has
 * finished. While a refresh runs the button is marked `aria-disabled` and
 * ignores clicks, rather than using `disabled`, which would drop it from the
 * tab order and send focus to the page body. It never moves focus. The status
 * is always rendered and empty until a refresh has finished, so the region
 * exists before its text changes.
 *
 * @example
 * <RefreshButton onRefresh={refresh} refreshing={refreshing} refreshed={refreshed} />
 */
export function RefreshButton({
  onRefresh,
  refreshing,
  refreshed
}: RefreshButtonProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <button
        type="button"
        aria-disabled={refreshing}
        onClick={() => {
          if (!refreshing) onRefresh()
        }}
      >
        {refreshing ? t('refreshing') : t('refresh')}
      </button>
      <p role="status" className="visuallyHidden">
        {refreshed ? t('refreshed') : ''}
      </p>
    </>
  )
}
