import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { LinkButton } from '@renderer/components/LinkButton'
import { MutedText } from '@renderer/components/MutedText'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { shortId } from '@renderer/features/sessions/sessionLabel'
import { WorktreePatchDialog } from '../patch/WorktreePatchDialog'
import { useIsArchivedSession } from '../useIsArchivedSession'
import { useWorktreeDiffs } from '../useWorktreeDiffs'
import { diffsOlderThanDetail } from './diffsOlderThanDetail'
import { InspectorHeading } from './InspectorHeading'
import { useAnnounceSharedWorktree } from './useAnnounceSharedWorktree'
import { useFocusHandoff } from './useFocusHandoff'
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
 * An archived session has no worktrees to diff, so the box says so in the same
 * status region that held the diffs, and nothing is requested. When a session
 * turns archived while focus is inside the box, focus moves to that message. A
 * teammate's box, which exists only for a shared worktree note, stays with the
 * message once that note has been shown.
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
  // An archived session has no worktrees to diff, so nothing is requested, and diffs cached
  // from before it turned archived are not shown.
  const archived = useIsArchivedSession(sessionRef)
  // Selecting another agent mounts a new reader. It runs git again only when the session
  // detail was refreshed after these diffs were loaded, so they follow the detail's freshness.
  const { data: loaded, isError } = useWorktreeDiffs(sessionRef, {
    enabled: !archived,
    refetchOnMount: diffsOlderThanDetail(queryClient, sessionRef)
  })
  const diffs = archived ? undefined : loaded
  const [patchOpen, setPatchOpen] = useState(false)
  const [hadBox, setHadBox] = useState(false)
  // The dialog belongs to a live session's diff, so it doesn't come back if the session does.
  if (archived && patchOpen) setPatchOpen(false)
  const { boxRef, targetRef } = useFocusHandoff<HTMLDivElement>(archived)
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
  // A teammate's box is there only for its shared worktree note. Once it has been shown, it
  // stays to say diffs are gone when the session turns archived, so focus in it has a place to land.
  if (shared !== null && !hadBox) setHadBox(true)
  if (agentId === null && shared === null && !(archived && hadBox)) return <>{status}</>

  const showShared = (): void => {
    if (shared === null) return
    showSession(shared.lead, { kind: 'subagent', ownerRef: shared.lead, agentId: shared.agentId })
  }

  return (
    <>
      {status}
      <section className={styles.box} ref={boxRef}>
        <InspectorHeading>{t('inspector.worktree.label')}</InspectorHeading>
        {branch !== null && (
          <p className={styles.branch}>
            <bdi>{branch}</bdi>
          </p>
        )}
        {(agentId !== null || archived) && (
          // The one region announces whichever of the result and the archived message it holds,
          // and takes focus when the message replaces what had it.
          <div role="status" className={styles.result} ref={targetRef} tabIndex={-1}>
            {archived ? (
              <MutedText>{t('inspector.worktree.archived')}</MutedText>
            ) : diffs === undefined ? (
              <MutedText>
                {isError ? t('inspector.worktree.loadFailed') : t('inspector.worktree.loading')}
              </MutedText>
            ) : (
              <WorktreeDiffResult diffs={diffs} entry={entry} />
            )}
          </div>
        )}
        {!archived && agentId !== null && branch !== null && hasChanges && (
          <>
            <LinkButton
              strong
              onClick={() => {
                setPatchOpen(true)
              }}
            >
              {t('inspector.patch.open')}
            </LinkButton>
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
            <MutedText>{sharedNote}</MutedText>
            <LinkButton onClick={showShared}>
              {t('inspector.worktree.showShared', { agent: shortId(shared.agentId) })}
            </LinkButton>
          </>
        )}
      </section>
    </>
  )
}
