import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { DialogHeader } from '@renderer/components/DialogHeader'
import { ModalDialog } from '@renderer/components/ModalDialog'
import { MutedText } from '@renderer/components/MutedText'
import { FileDiffBody } from './FileDiffBody'
import styles from './FileDiffDialog.module.css'
import type { FileDiffTarget } from './fileDiffTarget'

/** Props for {@link FileDiffDialog}. */
interface FileDiffDialogProps {
  /** Whether the dialog is open. The changes load only while it is. */
  readonly open: boolean
  /** Asks to close the dialog. */
  readonly onClose: () => void
  /** The agent and file to show. */
  readonly target: FileDiffTarget
  /** The agent's name, for the line under the heading. Transcript-derived. */
  readonly agentName: string
}

/**
 * A modal dialog with what one agent changed in one file, named by the file's
 * path with the agent's name beneath. Escape or Close closes it and focus goes
 * back to what opened it. The changes are fetched only while it is open.
 *
 * @example
 * <FileDiffDialog open={open} onClose={close} target={target} agentName="scout" />
 */
export function FileDiffDialog({
  open,
  onClose,
  target,
  agentName
}: FileDiffDialogProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const headingId = useId()

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy={headingId}>
      <DialogHeader
        headingId={headingId}
        heading={
          <bdi dir="ltr" className={styles.path}>
            {target.filePath}
          </bdi>
        }
        closeLabel={t('inspector.fileDiff.close')}
        onClose={onClose}
      >
        <MutedText wrapAnywhere>
          <bdi>{t('inspector.fileDiff.changesBy', { agent: agentName })}</bdi>
        </MutedText>
      </DialogHeader>
      <FileDiffBody target={target} />
    </ModalDialog>
  )
}
