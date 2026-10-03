import { useEffect, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import styles from './FirstRunScreen.module.css'
import { isMacOS } from './isMacOs'
import { useFirstRunStore } from './state/useFirstRunStore'

/**
 * The first-run view: what Beekeeper reads, that nothing leaves the
 * computer, and, on macOS, why it may ask for folder access. "Got it" dismisses it
 * and the choice persists. Takes focus on its heading when it appears, so a
 * screen reader announces the change of view.
 *
 * @example
 * <FirstRunScreen />
 */
export function FirstRunScreen(): React.JSX.Element {
  const { t } = useTranslation('firstRun')
  const dismiss = useFirstRunStore((state) => state.dismiss)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className={styles.screen}>
      <h1 id={MAIN_HEADING_ID} ref={headingRef} tabIndex={-1} className={styles.title}>
        {t('title')}
      </h1>

      <section className={styles.section} aria-labelledby="first-run-reads">
        <h2 id="first-run-reads" className={styles.heading}>
          {t('reads.heading')}
        </h2>
        <p>
          <Trans t={t} i18nKey="reads.body" components={{ code: <code /> }} />
        </p>
      </section>

      <section className={styles.section} aria-labelledby="first-run-local">
        <h2 id="first-run-local" className={styles.heading}>
          {t('local.heading')}
        </h2>
        <p>{t('local.body')}</p>
      </section>

      {isMacOS() && (
        <section className={styles.section} aria-labelledby="first-run-macos">
          <h2 id="first-run-macos" className={styles.heading}>
            {t('macos.heading')}
          </h2>
          <p>{t('macos.body')}</p>
        </section>
      )}

      <button type="button" className={styles.button} onClick={dismiss}>
        {t('dismiss')}
      </button>
    </div>
  )
}
