import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { agentCountLabel } from './agentCountLabel'
import { AgentStrip } from './AgentStrip'
import { CardColumns } from './CardColumns'
import { CardTokens } from './CardTokens'
import { cardFigures } from './cardFigures'
import { EmptyCell } from './EmptyCell'
import { activitySpanMs } from './activitySpanMs'
import { formatDuration } from './formatDuration'
import { rowMatches } from './sessionMatches'
import { SessionCell } from './SessionCell'
import styles from './SessionCard.module.css'
import type { SessionRow } from './sessionRow'
import { TeammateChip } from './TeammateChip'

/** Props for {@link SessionCard}. */
interface SessionCardProps {
  /** The card's row, with the teammates to show as chips. */
  readonly row: SessionRow
  /** The folder the list is for. */
  readonly selectedDirName: string
  /**
   * The search text from `normalizeQuery`, or `''` when no search is active or the card
   * has no chips to highlight. Passing `''` to a card without chips keeps it from re-rendering as the search changes.
   */
  readonly needle: string
  /** Whether the card's figures are partial, which adds a marker that the footnote explains. */
  readonly partial: boolean
  /**
   * The translated note naming the workflow or subagent the search matches
   * this session through, when its label and teammates don't match, or
   * `null`. A string, so a card without chips re-renders only when it changes.
   */
  readonly matchNote: string | null
}

/**
 * One session as a card: its title cell, an agent strip with the agent count,
 * the duration, and the tokens, then a chip for each teammate of a lead.
 * A session whose summary couldn't be read shows a placeholder name and
 * empty markers that say what is missing.
 *
 * @example
 * <SessionCard row={row} selectedDirName="-Users-me-repo" needle="" partial={false} matchNote={null} />
 */
export const SessionCard = memo(function SessionCard({
  row,
  selectedDirName,
  needle,
  partial,
  matchNote
}: SessionCardProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const { item, label, teammates } = row
  const { figures, teamTotal } = cardFigures(item)
  const agents = agentCountLabel(item, t)
  const duration = formatDuration(
    activitySpanMs(item.summary.ok ? item.summary.value.activity : null),
    t
  )
  const { projectDirName, sessionId } = item
  const leadRef = useMemo(() => ({ projectDirName, sessionId }), [projectDirName, sessionId])

  return (
    <li className={styles.card}>
      <CardColumns className={styles.grid}>
        <SessionCell row={row} selectedDirName={selectedDirName} matchNote={matchNote} />
        <div>
          <AgentStrip item={item} />
          <MutedText>
            <span className="visuallyHidden">{t('columns.agents')} </span>
            {agents ?? <EmptyCell />}
          </MutedText>
        </div>
        <p>
          <span className="visuallyHidden">{t('columns.duration')} </span>
          {duration ?? <EmptyCell />}
        </p>
        <CardTokens figures={figures} teamTotal={teamTotal} partial={partial} />
      </CardColumns>
      {teammates.length > 0 && (
        <ul className={styles.chips} aria-label={t('chips.label', { name: label.text })}>
          {teammates.map((teammate) => (
            <li key={teammate.key}>
              <TeammateChip
                teammate={teammate}
                leadRef={leadRef}
                selectedDirName={selectedDirName}
                highlighted={needle !== '' && rowMatches(teammate, needle)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
})
