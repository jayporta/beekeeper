import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { ModalDialog } from '@renderer/components/ModalDialog'
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
      <header className={styles.header}>
        <div className={styles.title}>
          <h2 id={headingId} className={styles.heading}>
            {t('inspector.patch.heading')}
          </h2>
          <p className={styles.branch}>
            <bdi>{branch}</bdi>
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          {t('inspector.patch.close')}
        </button>
      </header>
      <WorktreePatchBody sessionRef={sessionRef} agentId={agentId} />
    </ModalDialog>
  )
}
