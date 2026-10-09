import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import styles from './TelemetryFooter.module.css'
import { TelemetryDialog } from './TelemetryDialog'
import { useOtelReceiver } from './useOtelReceiver'

/**
 * The sidebar footer: the note that beekeeper is local only and read-only, which
 * adds that it is receiving Claude Code telemetry on 127.0.0.1 while the
 * receiver is listening, and the button that opens the telemetry dialog.
 *
 * @example
 * <TelemetryFooter />
 */
export function TelemetryFooter(): React.JSX.Element {
  const { t } = useTranslation('telemetry')
  const { data } = useOtelReceiver()
  const [open, setOpen] = useState(false)
  const listening = data?.status === 'listening'

  return (
    <>
      <MutedText smaller className={styles.note}>
        {listening ? t('localOnlyListening') : t('localOnly', { ns: 'common' })}
      </MutedText>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          setOpen(true)
        }}
      >
        {t('footerButton')}
      </button>
      <TelemetryDialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      />
    </>
  )
}
