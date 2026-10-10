import { useTranslation } from 'react-i18next'
import type { OtelReceiverDto } from '../../../../shared/ipc/otelReceiverDto'
import { useTelemetryAnnouncement } from './useTelemetryAnnouncement'

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
 * The telemetry dialog's status: that a change is saving, that saving it
 * failed, that the setting couldn't be read or is loading, or what the receiver
 * is doing (listening, off, why it couldn't start, or why turning it on failed
 * and it stays off). The visible line describes the checkbox and shows the
 * saving text, and is not a live region. A hidden polite region announces only
 * settled outcomes, once each, even when an outcome matches the last one. Both
 * stay mounted.
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

  function settledMessage(): string {
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

  const settled = settledMessage()
  const saving = savingEnabled !== null
  const shown = saving ? t(savingEnabled ? 'status.turningOn' : 'status.turningOff') : settled
  const announcement = useTelemetryAnnouncement({ message: settled, saving })

  return (
    <>
      <p id={id}>{shown}</p>
      <p role="status" className="visuallyHidden">
        <span key={announcement.id}>{announcement.message}</span>
      </p>
    </>
  )
}
