import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { EmptyCell } from './EmptyCell'
import { formatTokens } from './formatTokens'
import { folderNote, stoppedNote } from './itemNotes'
import { PARTIAL_FOOTNOTE_ID } from './partialFootnoteId'
import { PartialMarker } from './PartialMarker'
import { SeparatedText } from './SeparatedText'
import type { SessionRow } from './sessionRow'
import { sessionUsage } from './sessionUsage'
import styles from './TeammateChip.module.css'

/** Props for {@link TeammateChip}. */
interface TeammateChipProps {
  /** The teammate's row. */
  readonly teammate: SessionRow
  /** The lead's session, which the chip opens with this teammate selected. */
  readonly leadRef: SessionRefDto
  /** The folder the list is for, to mark a teammate that lives in another folder. */
  readonly selectedDirName: string
  /** Whether the teammate matches the search, which marks the chip by more than color. */
  readonly highlighted: boolean
}

/**
 * A button for one teammate under a lead's card: its name, a muted note
 * (stopped, its subagent count, or the folder it lives in), and its own
 * tokens. Pressing it opens the lead's session with the teammate selected.
 * It is memoized so a search change re-renders only the chips whose match changes.
 *
 * @example
 * <TeammateChip teammate={teammate} leadRef={leadRef} selectedDirName="-Users-me-repo" highlighted={false} />
 */
export const TeammateChip = memo(function TeammateChip({
  teammate,
  leadRef,
  selectedDirName,
  highlighted
}: TeammateChipProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const showSession = useNavigationStore((state) => state.showSession)
  const { item, label } = teammate
  const { tokens, tokensPartial } = sessionUsage(item).session
  const subagents = item.subagentCount ?? 0
  const notes = [
    stoppedNote(item, t),
    subagents > 0 ? t('agents.subagents', { count: subagents }) : null,
    folderNote(item, selectedDirName, t)
  ].filter((note) => note !== null)
  const formatted = formatTokens(tokens, t)

  return (
    <button
      type="button"
      className={highlighted ? `${styles.chip} ${styles.highlighted}` : styles.chip}
      aria-describedby={tokensPartial ? PARTIAL_FOOTNOTE_ID : undefined}
      onClick={() => {
        showSession(leadRef, {
          kind: 'teammate',
          ref: { projectDirName: item.projectDirName, sessionId: item.sessionId }
        })
      }}
    >
      <span className={styles.name}>{label.text}</span>{' '}
      {notes.length > 0 && (
        <>
          <span className={styles.note}>
            <SeparatedText parts={notes} />
          </span>{' '}
        </>
      )}
      <span>
        {formatted ?? <EmptyCell spokenText={t('emptyCell.tokensNotRecorded')} />}
        {tokensPartial && <PartialMarker />}
      </span>
      {highlighted && (
        <>
          {' '}
          <span className="visuallyHidden">{t('chip.matches')}</span>
        </>
      )}
    </button>
  )
})
