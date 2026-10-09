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
  /** The setting being saved right now (`true` is turning on), or `null` when no change is saving. */
  readonly savingEnabled: boolean | null
  /** The element id, so the checkbox can point `aria-describedby` at this line. */
  readonly id: string
}

/**
 * The one polite status line of the telemetry dialog: that a change is
 * saving, that saving it failed, that the setting couldn't be read or is
 * loading, or what the receiver is doing (listening, off, why it couldn't
 * start, or why turning it on failed and it stays off). A change that is
 * saving always shows its own text first, so an outcome that matches the last
 * one is still a change a screen reader hears. It stays mounted.
 *
 * @example
 * <TelemetryStatus receiver={data} loadFailed={false} saveFailed={false} savingEnabled={null} id={id} />
 */
export function TelemetryStatus({
  receiver,
  loadFailed,
  saveFailed,
  savingEnabled,
  id
}: TelemetryStatusProps): React.JSX.Element {
  const { t } = useTranslation('telemetry')

  function message(): string {
    if (savingEnabled !== null) return t(savingEnabled ? 'status.turningOn' : 'status.turningOff')
    if (saveFailed) return t('status.saveFailed')
    if (receiver === undefined) {
      return loadFailed ? t('status.loadFailed') : t('status.loading')
    }
    if (!receiver.enabled) {
      return receiver.status === 'failed'
        ? t(`status.turnOnFailure.${receiver.failure}`)
        : t('status.off')
    }
    if (receiver.status === 'listening') return t('status.listening', { port: receiver.port })
    return t(`status.failure.${receiver.failure ?? 'failed'}`, { port: receiver.port })
  }

  return (
    <p id={id} role="status">
      {message()}
    </p>
  )
}
