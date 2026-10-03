import { useTranslation } from 'react-i18next'
import { agentCountLabel } from './agentCountLabel'
import { AgentStrip } from './AgentStrip'
import { CardTokens } from './CardTokens'
import { cardFigures } from './cardFigures'
import { EmptyCell } from './EmptyCell'
import { formatDuration } from './formatDuration'
import type { PartialReason } from './partialReasons'
import { rowMatches } from './sessionMatches'
import { SessionCell } from './SessionCell'
import styles from './SessionCard.module.css'
import type { SessionRow } from './sessionRow'
import { TeammateChip } from './TeammateChip'
import columns from './CardColumns.module.css'

/** Props for {@link SessionCard}. */
interface SessionCardProps {
  /** The card's row, with the teammates to show as chips. */
  readonly row: SessionRow
  /** The folder the list is for. */
  readonly selectedDirName: string
  /** The search text from `normalizeQuery`, or `''` when no search is active. It highlights the chips that match. */
  readonly needle: string
  /** Why this card's figures are partial. A marker shows when it is not empty. */
  readonly reasons: ReadonlySet<PartialReason>
}

/**
 * One session as a card: its title cell, an agent strip with the agent count,
 * the duration, and the tokens, then a chip for each teammate of a lead.
 * A session whose summary couldn't be read shows a placeholder name and
 * empty markers that say what is missing.
 *
 * @example
 * <SessionCard row={row} selectedDirName="-Users-me-repo" needle="" reasons={new Set()} />
 */
export function SessionCard({
  row,
  selectedDirName,
  needle,
  reasons
}: SessionCardProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const { item, label, teammates } = row
  const { figures, teamTotal } = cardFigures(item)
  const agents = agentCountLabel(item, t)
  const duration = formatDuration(item.summary.ok ? item.summary.value.activity : null, t)
  const leadRef = { projectDirName: item.projectDirName, sessionId: item.sessionId }

  return (
    <li className={styles.card}>
      <div className={`${columns.columns} ${styles.grid}`}>
        <SessionCell row={row} selectedDirName={selectedDirName} />
        <div>
          <AgentStrip item={item} />
          <p className={styles.muted}>{agents ?? <EmptyCell />}</p>
        </div>
        <p>
          <span className="visuallyHidden">{t('columns.duration')} </span>
          {duration ?? <EmptyCell />}
        </p>
        <CardTokens figures={figures} teamTotal={teamTotal} partial={reasons.size > 0} />
      </div>
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
}
