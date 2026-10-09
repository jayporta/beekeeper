import { useTranslation } from 'react-i18next'
import styles from './TelemetryBody.module.css'
import { TelemetrySetup } from './TelemetrySetup'
import { TelemetryStatus } from './TelemetryStatus'
import { useOtelReceiver } from './useOtelReceiver'
import { useSetOtelReceiverEnabled } from './useSetOtelReceiverEnabled'

/**
 * What the telemetry dialog holds: what the receiver is for, the checkbox that
 * turns it on or off, its status, and, while it is on, the lines to set in
 * Claude Code's environment. The checkbox follows the saved setting and is
 * unavailable (`aria-disabled`, so it keeps focus) while the setting loads or a change is saving.
 *
 * @example
 * <TelemetryBody />
 */
export function TelemetryBody(): React.JSX.Element {
  const { t } = useTranslation('telemetry')
  const receiver = useOtelReceiver()
  const setEnabled = useSetOtelReceiverEnabled()
  const { data } = receiver
  // `aria-disabled`, not `disabled`: a disabled checkbox drops focus out of the dialog mid-save.
  const busy = data === undefined || setEnabled.isPending

  return (
    <div className={styles.body}>
      <p>{t('intro')}</p>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={data?.enabled ?? false}
          aria-disabled={busy}
          onChange={(event) => {
            if (!busy) setEnabled.mutate(event.target.checked)
          }}
        />
        {t('enable')}
      </label>
      <TelemetryStatus
        receiver={data}
        loadFailed={receiver.isError}
        saveFailed={setEnabled.isError}
      />
      {data?.enabled === true && <TelemetrySetup port={data.port} token={data.token} />}
    </div>
  )
}
