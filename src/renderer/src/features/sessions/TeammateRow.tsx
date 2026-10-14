import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { Pill } from '@renderer/components/Pill'
import { ShareBar } from '@renderer/components/ShareBar'
import { shareOfLargest } from '@renderer/components/shareOfLargest'
import { shareOfTotal } from '@renderer/components/shareOfTotal'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { AgentMark } from './AgentMark'
import { agentCounts } from './agentCounts'
import { workflowsText } from './agentCountLabel'
import { EmptyCell } from './EmptyCell'
import { folderNote, stoppedNote } from './itemNotes'
import { PARTIAL_FOOTNOTE_ID } from './partialFootnoteId'
import { SeparatedText } from './SeparatedText'
import type { SessionRow } from '../../../../shared/sessions/sessionRow'
import { sessionUsage } from '../../../../shared/sessions/sessionUsage'
import { teammateName } from './teammateName'
import styles from './TeammateRow.module.css'

/** Props for {@link TeammateRow}. */
interface TeammateRowProps {
  /** The teammate's row. */
  readonly teammate: SessionRow
  /** The lead's session, which the row opens with this teammate selected. */
  readonly leadRef: SessionRefDto
  /** The folder the list is for, to mark a teammate that lives in another folder. */
  readonly selectedDirName: string
  /** Whether the teammate matches the search, which marks the row by more than color. */
  readonly highlighted: boolean
  /** The tokens the lead's row shows, which the teammate's share is a part of, or `null` when it shows none. */
  readonly sessionTokens: number | null
}

/**
 * One teammate under a lead's row, on the same columns: its mark, name and
 * type, then its stopped and search-match pills with a muted note of its
 * subagent and workflow counts and its folder, a thin bar of its tokens
 * against the session's, its tokens, and its share of them. The share never
 * passes 100%, since a running teammate's transcript can hold more than the
 * team's recorded total. Pressing it opens the lead's session with the
 * teammate selected. It is memoized so a search change re-renders only the
 * rows whose match changes.
 *
 * @example
 * <TeammateRow teammate={teammate} leadRef={leadRef} selectedDirName="-Users-me-repo" highlighted={false} sessionTokens={5000} />
 */
export const TeammateRow = memo(function TeammateRow({
  teammate,
  leadRef,
  selectedDirName,
  highlighted,
  sessionTokens
}: TeammateRowProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const showSession = useNavigationStore((state) => state.showSession)
  const { item } = teammate
  const { name, type } = teammateName(teammate)
  const { tokens, tokensPartial } = sessionUsage(item).session
  const counts = agentCounts(item)
  const stopped = stoppedNote(item, t)
  const notes = [
    counts.subagents > 0 ? t('agents.subagents', { count: counts.subagents }) : null,
    workflowsText(counts, t),
    folderNote(item, selectedDirName, t)
  ].filter((note) => note !== null)
  const hasShare = tokens !== null && sessionTokens !== null && sessionTokens > 0
  const sharePercent = hasShare ? Math.min(100, shareOfTotal(tokens, sessionTokens)) : 0

  return (
    <button
      type="button"
      className={highlighted ? `${styles.row} ${styles.highlighted}` : styles.row}
      aria-describedby={tokensPartial ? PARTIAL_FOOTNOTE_ID : undefined}
      onClick={() => {
        showSession(leadRef, {
          kind: 'teammate',
          ref: { projectDirName: item.projectDirName, sessionId: item.sessionId }
        })
      }}
    >
      <span className={styles.who}>
        <span className={styles.mark} aria-hidden="true">
          <AgentMark kind="teammate" />
        </span>
        <span className={styles.name}>{name}</span>{' '}
        {type !== null && <span className={styles.type}>{type}</span>}
      </span>{' '}
      <span className={styles.status}>
        {stopped !== null && (
          <>
            <Pill tone="neutral">{stopped}</Pill>{' '}
          </>
        )}
        {highlighted && (
          <>
            <Pill tone="info">{t('teammate.matches')}</Pill>{' '}
          </>
        )}
        {notes.length > 0 && (
          <span className={styles.note}>
            <SeparatedText parts={notes} />
          </span>
        )}
      </span>{' '}
      <span />
      <ShareBar
        size="thin"
        share={hasShare ? shareOfLargest(tokens, sessionTokens) : 0}
        className={styles.bar}
      />{' '}
      <span className={styles.figure}>
        {tokens === null ? (
          <EmptyCell spokenText={t('emptyCell.tokensNotRecorded')} />
        ) : (
          <>
            {t('figure.compact', { value: tokens })}{' '}
            <span className="visuallyHidden">{t('tokensLabel')}</span>
          </>
        )}
        {tokensPartial && <PartialMarker note={t('partialNote')} />}
      </span>{' '}
      <span className={styles.figure}>
        {hasShare ? (
          <>
            {t('teammate.share', { value: sharePercent })}{' '}
            <span className="visuallyHidden">{t('teammate.shareSuffix')}</span>
          </>
        ) : (
          <span aria-hidden="true">-</span>
        )}
      </span>
    </button>
  )
})
