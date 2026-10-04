import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { shortId } from '@renderer/features/sessions/sessionLabel'
import { useWorktreeDiffs } from '../useWorktreeDiffs'
import { WorktreeDiffResult } from './WorktreeDiffResult'
import styles from './WorktreeDiffBox.module.css'

/** Props for {@link WorktreeDiffBox}. */
interface WorktreeDiffBoxProps {
  /** The session whose worktree diffs to read: the one that holds the subagent, or a teammate's own. */
  readonly sessionRef: SessionRefDto
  /** The subagent whose diff to show, or `null` for a teammate's own session, which has a diff only through a shared worktree. */
  readonly agentId: string | null
  /** The subagent's worktree branch, or `null` for a teammate's own session. Repo-controlled. */
  readonly branch: string | null
}

/**
 * The worktree diff of the inspected agent. A subagent that ran on a
 * worktree branch shows the branch and what it changed: lines added and
 * deleted across its files, or why git can't say. A teammate in a session of
 * its own has no branch, and shows a box only when it works in a worktree
 * that one of the lead's subagents owns, pointing at that subagent. The
 * diffs load only when the box mounts.
 *
 * @example
 * <WorktreeDiffBox sessionRef={ref} agentId="a1" branch="feature/x" />
 */
export function WorktreeDiffBox({
  sessionRef,
  agentId,
  branch
}: WorktreeDiffBoxProps): React.JSX.Element | null {
  const { t } = useTranslation('sessionDetail')
  const showSession = useNavigationStore((state) => state.showSession)
  const { data: diffs, isError } = useWorktreeDiffs(sessionRef, true)
  const shared = diffs?.sharedWorktree ?? null

  if (agentId === null && shared === null) return null

  return (
    <section className={styles.box}>
      <h3 className={styles.label}>{t('inspector.worktree.label')}</h3>
      {branch !== null && (
        <p className={styles.branch}>
          <bdi>{branch}</bdi>
        </p>
      )}
      {agentId !== null && diffs === undefined && (
        <p className={styles.note} role={isError ? undefined : 'status'}>
          {isError ? t('inspector.worktree.loadFailed') : t('inspector.worktree.loading')}
        </p>
      )}
      {agentId !== null && diffs !== undefined && (
        <WorktreeDiffResult
          diffs={diffs}
          entry={diffs.agents.find((agent) => agent.agentId === agentId)}
        />
      )}
      {shared !== null && (
        <>
          <p className={styles.note}>
            {t('inspector.worktree.shared', { agent: shortId(shared.agentId) })}
          </p>
          <button
            type="button"
            onClick={() => {
              showSession(shared.lead, {
                kind: 'subagent',
                ownerRef: shared.lead,
                agentId: shared.agentId
              })
            }}
          >
            {t('inspector.worktree.showShared')}
          </button>
        </>
      )}
    </section>
  )
}
