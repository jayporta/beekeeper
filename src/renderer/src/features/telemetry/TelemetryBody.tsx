import { useTranslation } from 'react-i18next'
import styles from './TelemetryBody.module.css'
import { TelemetrySetup } from './TelemetrySetup'
import { TelemetryStatus } from './TelemetryStatus'
import { useOtelReceiver } from './useOtelReceiver'
import { useSetOtelReceiverEnabled } from './useSetOtelReceiverEnabled'

/**
 * What the telemetry dialog holds: what the receiver is for, the checkbox that
 * turns it on or off, its status, and, while it has a token (it is on), the lines to set in
 * Claude Code's environment. The checkbox follows the saved setting and is
 * disabled while the setting loads or a change is saving.
 *
 * @example
 * <TelemetryBody />
 */
export function TelemetryBody(): React.JSX.Element {
  const { t } = useTranslation('telemetry')
  const receiver = useOtelReceiver()
  const setEnabled = useSetOtelReceiverEnabled()
  const { data } = receiver

  return (
    <div className={styles.body}>
      <p>{t('intro')}</p>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={data?.enabled ?? false}
          disabled={data === undefined || setEnabled.isPending}
          onChange={(event) => {
            setEnabled.mutate(event.target.checked)
          }}
        />
        {t('enable')}
      </label>
      <TelemetryStatus
        receiver={data}
        loadFailed={receiver.isError}
        saveFailed={setEnabled.isError}
      />
      {data !== undefined && data.token !== null && (
        <TelemetrySetup port={data.port} token={data.token} />
      )}
    </div>
  )
}
