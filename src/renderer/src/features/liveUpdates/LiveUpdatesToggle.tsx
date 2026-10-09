import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import styles from './LiveUpdatesToggle.module.css'
import { useLiveUpdatesStore } from './state/useLiveUpdatesStore'

/**
 * The checkbox that pauses and resumes live updates. It is checked while they
 * run. When they can't run it is disabled and unchecked, and a note says to use
 * Refresh, which the checkbox is described by.
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
          disabled={unavailable}
          aria-describedby={unavailable ? noteId : undefined}
          onChange={(event) => {
            setPaused(!event.target.checked)
          }}
        />
        {t('label')}
      </label>
      {unavailable && (
        <MutedText smaller id={noteId} className={styles.note}>
          {t('unavailable')}
        </MutedText>
      )}
    </div>
  )
}
