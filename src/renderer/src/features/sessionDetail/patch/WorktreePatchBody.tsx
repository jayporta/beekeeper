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
 * @example
 * <WorktreePatchBody sessionRef={ref} agentId="a1" />
 */
export function WorktreePatchBody({
  sessionRef,
  agentId
}: WorktreePatchBodyProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { data, isError } = useWorktreePatch(sessionRef, agentId)

  if (data === undefined) {
    return isError ? (
      <p className={styles.note}>{t('inspector.worktree.loadFailed')}</p>
    ) : (
      <p className={styles.note} role="status">
        {t('inspector.patch.loading')}
      </p>
    )
  }
  if (data.kind === 'unavailable') {
    return (
      <p className={styles.note}>
        {data.git === 'git-not-found'
          ? t('inspector.worktree.gitNotFound')
          : t('inspector.worktree.gitTooOld')}
      </p>
    )
  }
  if (data.kind === 'failed') {
    return (
      <p className={styles.note}>{t(`inspector.worktree.failure.${diffFailureKey(data.code)}`)}</p>
    )
  }

  return (
    <div className={styles.body}>
      {data.files.length === 0 && <p className={styles.note}>{t('inspector.patch.empty')}</p>}
      {data.files.map((file) => (
        <PatchFileView key={`${file.path}\0${file.oldPath ?? ''}`} file={file} />
      ))}
      {data.truncatedTotal && <p className={styles.note}>{t('inspector.patch.totalTruncated')}</p>}
    </div>
  )
}
