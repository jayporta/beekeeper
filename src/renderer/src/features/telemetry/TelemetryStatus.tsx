import { useTranslation } from 'react-i18next'
import type { OtelReceiverDto } from '../../../../shared/ipc/otelReceiverDto'

/** Props for {@link TelemetryStatus}. */
interface TelemetryStatusProps {
  /** The receiver's state, or `undefined` while it loads or when it couldn't be read. */
  readonly receiver: OtelReceiverDto | undefined
  /** Whether reading the receiver's state failed. */
  readonly loadFailed: boolean
  /** Whether saving the last change failed. */
  readonly saveFailed: boolean
}

/**
 * The one polite status line of the telemetry dialog: that saving a change
 * failed, that the setting couldn't be read or is loading, or what the receiver
 * is doing (listening, off, or why it couldn't start). It stays mounted, so a
 * screen reader hears each change.
 *
 * @example
 * <TelemetryStatus receiver={data} loadFailed={false} saveFailed={false} />
 */
export function TelemetryStatus({
  receiver,
  loadFailed,
  saveFailed
}: TelemetryStatusProps): React.JSX.Element {
  const { t } = useTranslation('telemetry')

  function message(): string {
    if (saveFailed) return t('status.saveFailed')
    if (receiver === undefined) {
      return loadFailed ? t('status.loadFailed') : t('status.loading')
    }
    if (receiver.status === 'listening') return t('status.listening', { port: receiver.port })
    if (receiver.status === 'failed') {
      return t(`status.failure.${receiver.failure ?? 'failed'}`, { port: receiver.port })
    }
    return t('status.off')
  }

  return <p role="status">{message()}</p>
}
