import { useTranslation } from 'react-i18next'
import type {
  AgentWorktreeDiffDto,
  WorktreeDiffsDto
} from '../../../../../shared/ipc/worktreeDiffDto'
import { diffFailureKey } from './diffFailureKey'
import { summarizeNumstat } from './summarizeNumstat'
import styles from './WorktreeDiffBox.module.css'

/** Props for {@link WorktreeDiffResult}. */
interface WorktreeDiffResultProps {
  /** The session's worktree diffs, once loaded. */
  readonly diffs: WorktreeDiffsDto
  /** The inspected subagent's entry, or `undefined` when the diffs hold none for it. */
  readonly entry: AgentWorktreeDiffDto | undefined
}

/**
 * What a loaded set of diffs says about one subagent: lines added and deleted
 * across its files, or a quiet note on why not: git isn't installed or is too
 * old, the diff couldn't be computed, or there is none for this agent.
 *
 * @example
 * <WorktreeDiffResult diffs={diffs} entry={entry} />
 */
export function WorktreeDiffResult({ diffs, entry }: WorktreeDiffResultProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  if (diffs.git === 'git-not-found') {
    return <p className={styles.note}>{t('inspector.worktree.gitNotFound')}</p>
  }
  if (diffs.git === 'git-too-old') {
    return <p className={styles.note}>{t('inspector.worktree.gitTooOld')}</p>
  }
  if (entry === undefined) {
    return <p className={styles.note}>{t('inspector.worktree.failure.failed')}</p>
  }
  if (!entry.result.ok) {
    return (
      <p className={styles.note}>
        {t(`inspector.worktree.failure.${diffFailureKey(entry.result.code)}`)}
      </p>
    )
  }

  const { added, deleted, files } = summarizeNumstat(entry.result.diff.files)
  return (
    <p className={styles.summary}>
      {t('inspector.worktree.summary', { added, deleted, count: files })}
    </p>
  )
}
