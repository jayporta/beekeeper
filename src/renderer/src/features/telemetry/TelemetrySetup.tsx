import { useTranslation } from 'react-i18next'
import { DialogButton } from '@renderer/components/DialogButton'
import { MutedText } from '@renderer/components/MutedText'
import styles from './TelemetrySetup.module.css'
import { telemetryEnvLines } from './telemetryEnvLines'
import { useCopyText } from './useCopyText'

/** Props for {@link TelemetrySetup}. */
interface TelemetrySetupProps {
  /** The loopback port the receiver listens on. */
  readonly port: number
  /** The bearer token Claude Code must send. A secret: it is shown only here. */
  readonly token: string
}

/**
 * What a person sets in Claude Code's environment to send it cost reports:
 * the shell lines, as selectable text in a keyboard-scrollable region, with a
 * Copy button and a status line that says how the copy went, and the notes
 * about earlier sessions and the content flags.
 *
 * @example
 * <TelemetrySetup port={47318} token={token} />
 */
export function TelemetrySetup({ port, token }: TelemetrySetupProps): React.JSX.Element {
  const { t } = useTranslation('telemetry')
  const { state, copy } = useCopyText()
  const lines = telemetryEnvLines({ port, token })
  const copyMessage = { idle: '', copied: t('setup.copied'), failed: t('setup.copyFailed') }[state]

  return (
    <section className={styles.setup}>
      <p>{t('setup.instructions')}</p>
      <div role="region" aria-label={t('setup.label')} tabIndex={0} className={styles.region}>
        <pre className={styles.lines}>
          <code>{lines}</code>
        </pre>
      </div>
      <div className={styles.actions}>
        <DialogButton
          onClick={() => {
            void copy(lines)
          }}
        >
          {t('setup.copy')}
        </DialogButton>
        <p role="status" className={styles.copyStatus}>
          {copyMessage}
        </p>
      </div>
      <MutedText>{t('setup.contentFlags')}</MutedText>
    </section>
  )
}
