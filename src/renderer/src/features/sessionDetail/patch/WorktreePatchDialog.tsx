import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { DialogHeader } from '@renderer/components/DialogHeader'
import { ModalDialog } from '@renderer/components/ModalDialog'
import { MutedText } from '@renderer/components/MutedText'
import styles from './WorktreePatchDialog.module.css'
import { WorktreePatchBody } from './WorktreePatchBody'

/** Props for {@link WorktreePatchDialog}. */
interface WorktreePatchDialogProps {
  /** Whether the dialog is open. The patch loads only while it is. */
  readonly open: boolean
  /** Asks to close the dialog. */
  readonly onClose: () => void
  /** The session that holds the subagent. */
  readonly sessionRef: SessionRefDto
  /** The subagent whose patch to show. */
  readonly agentId: string
  /** The subagent's worktree branch. Repo-controlled. */
  readonly branch: string
}

/**
 * A modal dialog with the plain-text patch of what one worktree agent changed,
 * named "Diff" with its branch beneath. Escape or Close closes it and focus
 * goes back to what opened it. The patch is fetched only while it is open.
 *
 * @example
 * <WorktreePatchDialog open={open} onClose={close} sessionRef={ref} agentId="a1" branch="feature/x" />
 */
export function WorktreePatchDialog({
  open,
  onClose,
  sessionRef,
  agentId,
  branch
}: WorktreePatchDialogProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const headingId = useId()

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy={headingId}>
      <DialogHeader
        headingId={headingId}
        heading={t('inspector.patch.heading')}
        closeLabel={t('inspector.patch.close')}
        onClose={onClose}
      >
        <MutedText wrapAnywhere className={styles.branch}>
          <bdi>{branch}</bdi>
        </MutedText>
      </DialogHeader>
      <WorktreePatchBody sessionRef={sessionRef} agentId={agentId} />
    </ModalDialog>
  )
}
