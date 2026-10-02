import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './RefreshButton.module.css'

/** Where a refresh stands. */
export type RefreshButtonStatus = 'idle' | 'refreshing' | 'refreshed' | 'failed'

/** The status message for each finished refresh. */
const MESSAGE_KEYS = { refreshed: 'refreshed', failed: 'refreshFailed' } as const

/** Props for {@link RefreshButton}. */
interface RefreshButtonProps {
  /** Starts the refresh. */
  readonly onRefresh: () => void
  /**
   * Where the refresh stands. While `refreshing` the button says so and
   * ignores clicks. `refreshed` is announced and `failed` is announced and
   * shown, each in a polite status.
   */
  readonly status: RefreshButtonStatus
}

/**
 * A "Refresh" button with a polite status beside it. While a refresh runs the
 * button is marked `aria-disabled` and ignores clicks, rather than using
 * `disabled`, which would drop it from the tab order and send focus to the
 * page body. It never moves focus. A success is announced and stays visually
 * hidden. A failure is announced and also shown, since it needs a person's
 * attention.
 *
 * Screen readers announce a live region's changes, not what it held when it
 * mounted. So the status renders empty, and its text is set once the region
 * is in the page, which announces even a failure already present when the
 * button mounts.
 *
 * @example
 * <RefreshButton onRefresh={refresh} status="idle" />
 */
export function RefreshButton({ onRefresh, status }: RefreshButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const refreshing = status === 'refreshing'
  const statusRef = useRef<HTMLParagraphElement>(null)
  const message = status === 'refreshed' || status === 'failed' ? t(MESSAGE_KEYS[status]) : ''

  useEffect(() => {
    if (statusRef.current !== null) statusRef.current.textContent = message
  }, [message])

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
      <p
        ref={statusRef}
        role="status"
        className={status === 'failed' ? styles.note : 'visuallyHidden'}
      />
    </>
  )
}
