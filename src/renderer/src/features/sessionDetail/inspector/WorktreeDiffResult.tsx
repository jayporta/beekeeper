import { useTranslation } from 'react-i18next'
import type {
  AgentWorktreeDiffDto,
  WorktreeDiffsDto
} from '../../../../../shared/ipc/worktreeDiffDto'
import { MutedText } from '@renderer/components/MutedText'
import { diffFailureKey } from './diffFailureKey'
import { summarizeNumstat } from './summarizeNumstat'
import { uncommittedNoteKey } from './uncommittedNoteKey'
import styles from './WorktreeDiffResult.module.css'

/** Props for {@link WorktreeDiffResult}. */
interface WorktreeDiffResultProps {
  /** The session's worktree diffs, once loaded. */
  readonly diffs: WorktreeDiffsDto
  /** The inspected subagent's entry, or `undefined` when the diffs hold none for it. */
  readonly entry: AgentWorktreeDiffDto | undefined
}

/**
 * What a loaded set of diffs says about one subagent: lines added and deleted
 * across its files and how many paths are untracked, with a quiet note when
 * uncommitted work isn't included, or a quiet note on why there is no diff:
 * git isn't installed or is too old, the diff couldn't be computed, or there
 * is none for this agent.
 *
 * @example
 * <WorktreeDiffResult diffs={diffs} entry={entry} />
 */
export function WorktreeDiffResult({ diffs, entry }: WorktreeDiffResultProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  if (diffs.git === 'git-not-found') {
    return <MutedText>{t('inspector.worktree.gitNotFound')}</MutedText>
  }
  if (diffs.git === 'git-too-old') {
    return <MutedText>{t('inspector.worktree.gitTooOld')}</MutedText>
  }
  if (entry === undefined) {
    return <MutedText>{t('inspector.worktree.failure.failed')}</MutedText>
  }
  if (!entry.result.ok) {
    return (
      <MutedText>{t(`inspector.worktree.failure.${diffFailureKey(entry.result.code)}`)}</MutedText>
    )
  }

  const { uncommitted, untracked } = entry.result.diff
  const { added, deleted, files } = summarizeNumstat(entry.result.diff.files)
  const noteKey = uncommittedNoteKey(uncommitted)
  return (
    <>
      <p className={styles.summary}>
        {t('inspector.worktree.summary', { added, deleted, count: files })}
        {untracked.length > 0 && (
          <> {t('inspector.worktree.untracked', { count: untracked.length })}</>
        )}
      </p>
      {noteKey !== null && <MutedText>{t(`inspector.worktree.${noteKey}`)}</MutedText>}
    </>
  )
}
