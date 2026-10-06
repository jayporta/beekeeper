import { useId } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { DialogHeader } from '@renderer/components/DialogHeader'
import { ModalDialog } from '@renderer/components/ModalDialog'
import styles from './AboutDialog.module.css'
import { useAboutRequested } from './useAboutRequested'

/**
 * A modal About dialog that opens when the menu's About item is chosen. It says
 * what beekeeper reads and that it stays on the computer. Escape or Close
 * closes it and focus goes back to what had it before. Mount it once, outside
 * anything that waits for stored state, so it opens at any time.
 *
 * @example
 * <AboutDialog />
 */
export function AboutDialog(): React.JSX.Element {
  const { t } = useTranslation('about')
  const { open, close } = useAboutRequested()
  const headingId = useId()

  return (
    <ModalDialog open={open} onClose={close} labelledBy={headingId} className={styles.dialog}>
      <DialogHeader
        headingId={headingId}
        heading={t('heading')}
        closeLabel={t('close')}
        onClose={close}
      />
      <div className={styles.body}>
        <p>
          <Trans t={t} i18nKey="description" components={{ code: <code /> }} />
        </p>
        <p>
          <Trans t={t} i18nKey="promise" components={{ code: <code /> }} />
        </p>
      </div>
    </ModalDialog>
  )
}
