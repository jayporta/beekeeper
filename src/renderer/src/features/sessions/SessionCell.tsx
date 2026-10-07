import { useTranslation } from 'react-i18next'
import { CardOpenButton } from '@renderer/components/CardOpenButton'
import { MutedText } from '@renderer/components/MutedText'
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
  /** The subagent the search matches this session through, or `null`. It adds a muted line naming it. */
  readonly matchedAgent: string | null
}

/**
 * The title cell of a session card: the session's name as a button that opens
 * it, a short id beside a placeholder name, and a muted line with when it was
 * last active, its model, and notes such as a plan limit it hit, and a line
 * naming the subagent the search matched when nothing else on the card did. The button
 * stretches over the whole card, so the card is one target, while the
 * teammate chips sit above it.
 *
 * @example
 * <SessionCell row={row} selectedDirName="-Users-me-repo" matchedAgent={null} />
 */
export function SessionCell({
  row,
  selectedDirName,
  matchedAgent
}: SessionCellProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const showSession = useNavigationStore((state) => state.showSession)
  const { item, label } = row
  const summary = item.summary.ok ? item.summary.value : null
  const nowMs = useNowUntil(summary?.limitHit?.resetsAtMs ?? null)
  const meta = [
    formatLastActive(lastActiveMs(item), t),
    summary?.model ?? null,
    ...notesFor(row, { selectedDirName, nowMs, t })
  ].filter((part) => part !== null)

  return (
    <div className={styles.cell}>
      <h2 className={styles.title}>
        <CardOpenButton
          onClick={() => {
            showSession({ projectDirName: item.projectDirName, sessionId: item.sessionId })
          }}
        >
          {label.text}
        </CardOpenButton>
      </h2>
      {label.idHint !== null && <MutedText wrapAnywhere>{label.idHint}</MutedText>}
      <MutedText wrapAnywhere>
        <SeparatedText parts={meta} />
      </MutedText>
      {matchedAgent !== null && (
        <MutedText wrapAnywhere>{t('matchingSubagent', { agent: matchedAgent })}</MutedText>
      )}
    </div>
  )
}
