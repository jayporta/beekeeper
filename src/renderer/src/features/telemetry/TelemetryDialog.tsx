import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { DialogHeader } from '@renderer/components/DialogHeader'
import { ModalDialog } from '@renderer/components/ModalDialog'
import { TelemetryBody } from './TelemetryBody'
import styles from './TelemetryDialog.module.css'

/** Props for {@link TelemetryDialog}. */
interface TelemetryDialogProps {
  /** Whether the dialog is open. */
  readonly open: boolean
  /** Called when the dialog asks to close, for Escape or the Close button. */
  readonly onClose: () => void
}

/**
 * The modal dialog for the opt-in Claude Code telemetry receiver: turn it on
 * or off, see whether it is listening, and copy the lines Claude Code needs.
 * Escape or Close closes it, and focus goes back to what had it before.
 *
 * @example
 * <TelemetryDialog open={open} onClose={() => setOpen(false)} />
 */
export function TelemetryDialog({ open, onClose }: TelemetryDialogProps): React.JSX.Element {
  const { t } = useTranslation('telemetry')
  const headingId = useId()

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy={headingId} className={styles.dialog}>
      <DialogHeader
        headingId={headingId}
        heading={t('heading')}
        closeLabel={t('close')}
        onClose={onClose}
      />
      <TelemetryBody />
    </ModalDialog>
  )
}
