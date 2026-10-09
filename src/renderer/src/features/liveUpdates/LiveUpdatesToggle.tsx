import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import styles from './LiveUpdatesToggle.module.css'
import { useLiveUpdatesStore } from './state/useLiveUpdatesStore'

/**
 * The checkbox that pauses and resumes live updates. It is checked while they
 * run. When they can't run it is unchecked and marked disabled, but it stays
 * focusable, so a person on it doesn't lose their place. A polite status
 * region, mounted from the start so its change is announced, then says to use
 * Refresh, and the checkbox is described by it.
 *
 * @example
 * <LiveUpdatesToggle />
 */
export function LiveUpdatesToggle(): React.JSX.Element {
  const { t } = useTranslation('liveUpdates')
  const paused = useLiveUpdatesStore((state) => state.paused)
  const unavailable = useLiveUpdatesStore((state) => state.unavailable)
  const setPaused = useLiveUpdatesStore((state) => state.setPaused)
  const noteId = useId()

  return (
    <div className={styles.toggle}>
      <label className={styles.label}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={!paused && !unavailable}
          aria-disabled={unavailable || undefined}
          aria-describedby={unavailable ? noteId : undefined}
          onChange={(event) => {
            if (!unavailable) setPaused(!event.target.checked)
          }}
        />
        {t('label')}
      </label>
      <MutedText smaller role="status" id={noteId} className={styles.note}>
        {unavailable && t('unavailable')}
      </MutedText>
    </div>
  )
}
