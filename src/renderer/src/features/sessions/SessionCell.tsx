import { useTranslation } from 'react-i18next'
import { CardOpenButton } from '@renderer/components/CardOpenButton'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { Pill } from '@renderer/components/Pill'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { formatLastActive } from './formatLastActive'
import { lastActiveMs } from './lastActiveMs'
import { notesFor } from './notesFor'
import { SeparatedText } from './SeparatedText'
import styles from './SessionCell.module.css'
import type { SessionRow } from './sessionRow'
import { useNowUntil } from './useNowUntil'

/** Props for {@link SessionCell}. */
interface SessionCellProps {
  /** The card's row. */
  readonly row: SessionRow
  /** The folder the list is for, to mark a session from another folder. */
  readonly selectedDirName: string
  /** The note naming the workflow or subagent the search matches this session through, or `null`. It adds a muted line. */
  readonly matchNote: string | null
}

/**
 * The title cell of a session row: the session's name as a button that opens
 * it, a short id beside a placeholder name, a muted line with when it was last
 * active, its model, and plain notes such as its team, then pills for its
 * statuses (archived, stopped, a plan limit it hit, its signal counts), and a
 * line naming the workflow or subagent the search matched when nothing else on
 * the row did. The signal counts carry a partial marker after the last pill
 * when a transcript behind them hit the event cap. The button stretches over
 * the row's grid, so the row is one target.
 *
 * @example
 * <SessionCell row={row} selectedDirName="-Users-me-repo" matchNote={null} />
 */
export function SessionCell({
  row,
  selectedDirName,
  matchNote
}: SessionCellProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const showSession = useNavigationStore((state) => state.showSession)
  const { item, label } = row
  const summary = item.summary.ok ? item.summary.value : null
  const nowMs = useNowUntil(summary?.limitHit?.resetsAtMs ?? null)
  const notes = notesFor(row, { selectedDirName, nowMs, t })
  const meta = [
    formatLastActive(lastActiveMs(item), t),
    summary?.model ?? null,
    ...notes.meta
  ].filter((part) => part !== null)

  return (
    <div className={styles.cell}>
      <h3 className={styles.title}>
        <CardOpenButton
          className={styles.open}
          onClick={() => {
            showSession({ projectDirName: item.projectDirName, sessionId: item.sessionId })
          }}
        >
          {label.text}
        </CardOpenButton>
      </h3>
      {label.idHint !== null && <MutedText wrapAnywhere>{label.idHint}</MutedText>}
      <MutedText wrapAnywhere>
        <SeparatedText parts={meta} />
      </MutedText>
      {notes.pills.length > 0 && (
        <div className={styles.pills}>
          {notes.pills.map((pill) => (
            <span key={pill.text} className={styles.pill}>
              <Pill tone={pill.tone}>{pill.text}</Pill>
              {pill.signalsMarker && <PartialMarker note={t('signalsPartialNote')} />}
            </span>
          ))}
        </div>
      )}
      {matchNote !== null && <MutedText wrapAnywhere>{matchNote}</MutedText>}
    </div>
  )
}
