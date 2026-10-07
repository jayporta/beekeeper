import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { shortId } from '@renderer/features/sessions/sessionLabel'
import { WorktreePatchDialog } from '../patch/WorktreePatchDialog'
import { useWorktreeDiffs } from '../useWorktreeDiffs'
import { diffsOlderThanDetail } from './diffsOlderThanDetail'
import { InspectorHeading } from './InspectorHeading'
import { InspectorNote } from './InspectorNote'
import { useAnnounceSharedWorktree } from './useAnnounceSharedWorktree'
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
 * diffs load only when the box mounts. A subagent that changed files has an
 * "Open diff" button, which opens its patch in a dialog.
 *
 * @example
 * <WorktreeDiffBox sessionRef={ref} agentId="a1" branch="feature/x" />
 */
export function WorktreeDiffBox({
  sessionRef,
  agentId,
  branch
}: WorktreeDiffBoxProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const showSession = useNavigationStore((state) => state.showSession)
  const queryClient = useQueryClient()
  // Selecting another agent mounts a new reader. It runs git again only when the session
  // detail was refreshed after these diffs were loaded, so they follow the detail's freshness.
  const { data: diffs, isError } = useWorktreeDiffs(sessionRef, {
    enabled: true,
    refetchOnMount: diffsOlderThanDetail(queryClient, sessionRef)
  })
  const [patchOpen, setPatchOpen] = useState(false)
  // The shared worktree belongs to a teammate session's own agent, not to its subagents.
  const shared = agentId === null ? (diffs?.sharedWorktree ?? null) : null
  const sharedNote =
    shared === null ? null : t('inspector.worktree.shared', { agent: shortId(shared.agentId) })
  const announcement = useAnnounceSharedWorktree(sharedNote)
  const entry = diffs?.agents.find((agent) => agent.agentId === agentId)
  const hasChanges = entry?.result.ok === true && entry.result.diff.files.length > 0

  // The status region stays mounted, even while there is no box, so the note's arrival is announced.
  const status = agentId === null && (
    <p role="status" className="visuallyHidden">
      {announcement}
    </p>
  )
  if (agentId === null && shared === null) return <>{status}</>

  return (
    <>
      {status}
      <section className={styles.box}>
        <InspectorHeading>{t('inspector.worktree.label')}</InspectorHeading>
        {branch !== null && (
          <p className={styles.branch}>
            <bdi>{branch}</bdi>
          </p>
        )}
        {agentId !== null && (
          <div role="status" className={styles.result}>
            {diffs === undefined ? (
              <InspectorNote>
                {isError ? t('inspector.worktree.loadFailed') : t('inspector.worktree.loading')}
              </InspectorNote>
            ) : (
              <WorktreeDiffResult diffs={diffs} entry={entry} />
            )}
          </div>
        )}
        {agentId !== null && branch !== null && hasChanges && (
          <>
            <button
              type="button"
              className={styles.open}
              onClick={() => {
                setPatchOpen(true)
              }}
            >
              {t('inspector.patch.open')}
            </button>
            <WorktreePatchDialog
              open={patchOpen}
              onClose={() => {
                setPatchOpen(false)
              }}
              sessionRef={sessionRef}
              agentId={agentId}
              branch={branch}
            />
          </>
        )}
        {shared !== null && (
          <>
            <InspectorNote>{sharedNote}</InspectorNote>
            <button
              type="button"
              className={styles.show}
              onClick={() => {
                showSession(shared.lead, {
                  kind: 'subagent',
                  ownerRef: shared.lead,
                  agentId: shared.agentId
                })
              }}
            >
              {t('inspector.worktree.showShared', { agent: shortId(shared.agentId) })}
            </button>
          </>
        )}
      </section>
    </>
  )
}
