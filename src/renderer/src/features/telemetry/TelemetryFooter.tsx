import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LinkButton } from '@renderer/components/LinkButton'
import { MutedText } from '@renderer/components/MutedText'
import styles from './TelemetryFooter.module.css'
import { TelemetryDialog } from './TelemetryDialog'
import { useOtelReceiver } from './useOtelReceiver'
import { useOtelReceiverChanges } from './useOtelReceiverChanges'

/**
 * The sidebar footer: the note that beekeeper is local only and read-only, which
 * adds that it is receiving Claude Code telemetry on 127.0.0.1 while the
 * receiver is listening, and the button that opens the telemetry dialog. It also
 * keeps the receiver's state current when the main process reports a change.
 *
 * @example
 * <TelemetryFooter />
 */
export function TelemetryFooter(): React.JSX.Element {
  const { t } = useTranslation('telemetry')
  const { data } = useOtelReceiver()
  useOtelReceiverChanges()
  const [open, setOpen] = useState(false)
  const listening = data?.status === 'listening'

  return (
    <>
      <MutedText smaller className={styles.note}>
        {listening ? t('localOnlyListening') : t('localOnly', { ns: 'common' })}
      </MutedText>
      <LinkButton
        padded
        onClick={() => {
          setOpen(true)
        }}
      >
        {t('footerButton')}
      </LinkButton>
      <TelemetryDialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      />
    </>
  )
}
