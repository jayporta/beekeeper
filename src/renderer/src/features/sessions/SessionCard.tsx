import { memo, useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { ShareBar } from '@renderer/components/ShareBar'
import { shareOfLargest } from '@renderer/components/shareOfLargest'
import { agentCountLabel } from './agentCountLabel'
import { AgentStrip } from './AgentStrip'
import { AgentsToggle } from './AgentsToggle'
import { CardColumns } from './CardColumns'
import { CardPrice } from './CardPrice'
import { CardTokens } from './CardTokens'
import { cardFigures } from './cardFigures'
import { EmptyCell } from './EmptyCell'
import { activitySpanMs } from './activitySpanMs'
import { formatDuration } from './formatDuration'
import { SessionCell } from './SessionCell'
import styles from './SessionCard.module.css'
import type { SessionRow } from './sessionRow'
import { useExpandedSessionsStore } from './state/useExpandedSessionsStore'
import { TeammateRow } from './TeammateRow'

/** Props for {@link SessionCard}. */
interface SessionCardProps {
  /** The card's row, with the teammates to show as rows. */
  readonly row: SessionRow
  /** The folder the list is for. */
  readonly selectedDirName: string
  /**
   * The keys of the teammates the search matches, joined by a NUL, or `''` for none or when no search
   * is active. A string, so a row re-renders only when the set of matching teammates changes.
   */
  readonly matchedTeammates: string
  /** The most tokens any card in the whole list shows, which the row's bar is drawn against. */
  readonly largestTokens: number
  /** Whether the card's figures are partial, which adds a marker that the footnote explains. */
  readonly partial: boolean
  /**
   * The translated note naming the workflow or subagent the search matches
   * this session through, when its label and teammates don't match, or
   * `null`. A string, so a card re-renders only when it changes.
   */
  readonly matchNote: string | null
  /**
   * The note naming the first teammate the search matches, or `null`. It shows only while the
   * teammates are hidden, so a row listed for a teammate says why.
   */
  readonly teammateNote: string | null
}

/**
 * One session as a row of the sessions table: its title cell, an agent strip
 * with the agent count, the duration, a bar of its tokens against the largest
 * row's, its tokens, and its API price, then, when open, a row for each teammate of a lead. A lead's agent count is the button that opens
 * and closes them: a search match opens them, and a person's own choice wins.
 * A session whose summary couldn't be read shows a placeholder name and
 * empty markers that say what is missing.
 *
 * @example
 * <SessionCard row={row} selectedDirName="-Users-me-repo" matchedTeammates="" largestTokens={0} partial={false} matchNote={null} teammateNote={null} />
 */
export const SessionCard = memo(function SessionCard({
  row,
  selectedDirName,
  matchedTeammates,
  largestTokens,
  partial,
  matchNote,
  teammateNote
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
  const listId = useId()
  const hasTeammates = teammates.length > 0
  const matchedKeys = useMemo(
    () => new Set(matchedTeammates === '' ? [] : matchedTeammates.split('\0')),
    [matchedTeammates]
  )
  // A person's own choice wins; else a search match opens the teammates.
  const expanded = useExpandedSessionsStore(
    (state) => hasTeammates && (state.expanded[row.key] ?? matchedKeys.size > 0)
  )
  const toggle = useExpandedSessionsStore((state) => state.toggle)

  return (
    <li className={styles.row}>
      <CardColumns className={styles.grid}>
        <SessionCell
          row={row}
          selectedDirName={selectedDirName}
          matchNote={matchNote ?? (expanded ? null : teammateNote)}
        />
        <div>
          <AgentStrip item={item} />
          <MutedText>
            <span className="visuallyHidden">{t('columns.agents')} </span>
            {agents === null ? (
              <EmptyCell />
            ) : hasTeammates ? (
              <AgentsToggle
                expanded={expanded}
                controls={expanded ? listId : undefined}
                onToggle={() => {
                  toggle(row.key, expanded)
                }}
              >
                {agents}
              </AgentsToggle>
            ) : (
              agents
            )}
          </MutedText>
        </div>
        <p className={styles.duration}>
          <span className="visuallyHidden">{t('columns.duration')} </span>
          {duration ?? <EmptyCell />}
        </p>
        <div className={styles.bar}>
          <ShareBar share={shareOfLargest(figures?.tokens ?? 0, largestTokens)} />
        </div>
        <CardTokens figures={figures} teamTotal={teamTotal} partial={partial} />
        <CardPrice figures={figures} />
      </CardColumns>
      {expanded && (
        <ul
          id={listId}
          className={styles.teammates}
          aria-label={t('teammates.label', { name: label.text })}
        >
          {teammates.map((teammate) => (
            <li key={teammate.key}>
              <TeammateRow
                teammate={teammate}
                leadRef={leadRef}
                selectedDirName={selectedDirName}
                highlighted={matchedKeys.has(teammate.key)}
                sessionTokens={figures?.tokens ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
})
