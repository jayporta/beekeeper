import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './RefreshButton.module.css'
import { STATUS_ANNOUNCE_DELAY_MS } from './statusAnnounceDelay'
import type { RefreshStatus } from './useRefreshLists'

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
  readonly status: RefreshStatus
}

/**
 * A "Refresh" button with a note and a polite status beside it. While a
 * refresh runs the button is marked `aria-disabled` and ignores clicks,
 * rather than using `disabled`, which would drop it from the tab order and
 * send focus to the page body. It never moves focus.
 *
 * A failure is shown at once in a note that is hidden from assistive tech,
 * since the status announces it. The status is always visually hidden and
 * carries both messages. Screen readers announce a live region's changes, not
 * what it held when it mounted, so it renders empty, and on every message
 * change it is cleared and then filled after {@link STATUS_ANNOUNCE_DELAY_MS}.
 * That announces even a failure already present when the button mounts, and
 * keeps a failure that clears and returns quickly from merging into no
 * change. Each message is heard once, through the status.
 *
 * @example
 * <RefreshButton onRefresh={refresh} status="idle" />
 */
export function RefreshButton({ onRefresh, status }: RefreshButtonProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const refreshing = status === 'refreshing'
  const statusRef = useRef<HTMLParagraphElement>(null)
  const message = status === 'refreshed' || status === 'failed' ? t(MESSAGE_KEYS[status]) : ''

  useEffect(() => {
    const region = statusRef.current
    if (region === null) return undefined
    region.textContent = ''
    if (message === '') return undefined
    const timer = setTimeout(() => {
      region.textContent = message
    }, STATUS_ANNOUNCE_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
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
      {status === 'failed' && (
        <p className={styles.note} aria-hidden="true">
          {message}
        </p>
      )}
      <p ref={statusRef} role="status" className="visuallyHidden" />
    </>
  )
}
