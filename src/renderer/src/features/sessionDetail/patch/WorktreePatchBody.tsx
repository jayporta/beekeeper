import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { diffFailureKey } from '../inspector/diffFailureKey'
import { PatchFileView } from './PatchFileView'
import styles from './WorktreePatchBody.module.css'
import { useWorktreePatch } from './useWorktreePatch'

/** Props for {@link WorktreePatchBody}. */
interface WorktreePatchBodyProps {
  /** The session that holds the subagent. */
  readonly sessionRef: SessionRefDto
  /** The subagent whose patch to show. */
  readonly agentId: string
}

/**
 * What the patch view shows once it is open: the patch loading, why it can't
 * be shown (git is missing or too old, git failed, or the call failed), or the
 * agent's changed files. A diff over the size cap says so, as a note.
 *
 * One status region stays mounted throughout and holds the outcome, so a
 * screen reader hears that the patch loaded or failed while focus stays on the
 * dialog's Close button. It is visible text for a note, and a visually hidden
 * summary once files show, so the patch text itself is never announced.
 *
 * @example
 * <WorktreePatchBody sessionRef={ref} agentId="a1" />
 */
export function WorktreePatchBody({
  sessionRef,
  agentId
}: WorktreePatchBodyProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { data, isError } = useWorktreePatch(sessionRef, agentId)

  const files = data?.kind === 'ready' ? data.files : []

  function outcome(): string {
    if (data === undefined) {
      return isError ? t('inspector.worktree.loadFailed') : t('inspector.patch.loading')
    }
    if (data.kind === 'unavailable') {
      return data.git === 'git-not-found'
        ? t('inspector.worktree.gitNotFound')
        : t('inspector.worktree.gitTooOld')
    }
    if (data.kind === 'failed') {
      return t(`inspector.worktree.failure.${diffFailureKey(data.code)}`)
    }
    return files.length === 0
      ? t('inspector.patch.empty')
      : t('inspector.patch.loaded', { count: files.length })
  }

  return (
    <div className={styles.body}>
      <p role="status" className={files.length > 0 ? 'visuallyHidden' : styles.note}>
        {outcome()}
      </p>
      {files.map((file) => (
        <PatchFileView key={`${file.path}\0${file.oldPath ?? ''}`} file={file} />
      ))}
      {data?.kind === 'ready' && data.truncatedTotal && (
        <p className={styles.note}>{t('inspector.patch.totalTruncated')}</p>
      )}
    </div>
  )
}
