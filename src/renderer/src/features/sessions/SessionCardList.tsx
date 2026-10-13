import { memo, useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@renderer/components/Card'
import { MutedText } from '@renderer/components/MutedText'
import { AgentLegend } from './AgentLegend'
import { agentMarks, type AgentMarkKind } from './agentMarks'
import { CardColumns } from './CardColumns'
import { matchOf, rowMatches } from './sessionMatches'
import { teammateName } from './teammateName'
import { PartialFootnote } from './PartialFootnote'
import { partialReasons, type PartialReason } from './partialReasons'
import { SessionCard } from './SessionCard'
import { signalsMarked, signalTotalsOf } from './signalNotes'
import { SignalScopeNote } from './SignalScopeNote'
import styles from './SessionCardList.module.css'
import type { SessionRow } from './sessionRow'

const KIND_ORDER = [
  'lead',
  'teammate',
  'workflow',
  'subagent'
] as const satisfies readonly AgentMarkKind[]

/** The kinds of mark that the cards' agent strips draw, in the legend's order. */
function kindsDrawn(rows: readonly SessionRow[]): readonly AgentMarkKind[] {
  const drawn = new Set(rows.flatMap((row) => agentMarks(row.item).marks))
  return KIND_ORDER.filter((kind) => drawn.has(kind))
}

/** Props for {@link SessionCardList}. */
interface SessionCardListProps {
  /** The top-level rows to show, already filtered. */
  readonly rows: readonly SessionRow[]
  /** The id of the heading that names the list. */
  readonly labelledBy: string
  /** The folder the list is for. */
  readonly selectedDirName: string
  /** The most tokens any session in the whole list shows, which every row's bar is drawn against. */
  readonly largestTokens: number
  /** How many sessions match the search, shown beside the title, or `null` when no search is active. */
  readonly matchCount: number | null
  /** The search text from `normalizeQuery`, or `''` when no search is active. It marks the teammates that match and names the workflow or subagent a card matches only through. */
  readonly query: string
}

/**
 * The Sessions card: a title with the match count while searching and a
 * legend for the agent marks on screen, then the rows under a column header
 * row, then a footnote for any partial figure or any signal count marked
 * partial, and a note on what the signal counts cover. The rows keep a least
 * width and scroll sideways inside the card. The header row is visual only:
 * each row says what its figures are in words. It is memoized so a keystroke in the search box skips it until the
 * deferred filter catches up.
 *
 * @example
 * <SessionCardList rows={rows} labelledBy={headingId} selectedDirName="-Users-me-repo" largestTokens={5_000} matchCount={null} query="" />
 */
export const SessionCardList = memo(function SessionCardList({
  rows,
  labelledBy,
  selectedDirName,
  largestTokens,
  matchCount,
  query
}: SessionCardListProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const titleId = useId()
  const cards = useMemo(() => rows.map((row) => ({ row, reasons: partialReasons(row) })), [rows])
  const allReasons = useMemo(() => {
    const reasons = new Set<PartialReason>(cards.flatMap(({ reasons }) => [...reasons]))
    if (rows.some(({ item }) => signalsMarked(signalTotalsOf(item)))) {
      reasons.add('incompleteSignals')
    }
    return reasons
  }, [cards, rows])
  const kinds = useMemo(() => kindsDrawn(rows), [rows])
  // Worked out here, as strings or `null`, so a row re-renders only when its own match changes.
  const matches = useMemo(
    () =>
      rows.map((row) => {
        const match = matchOf(row, query)
        const matching = query === '' ? [] : row.teammates.filter((mate) => rowMatches(mate, query))
        const first = matching[0]
        return {
          note:
            match === null
              ? null
              : match.kind === 'workflow'
                ? t('matchingWorkflow', { workflow: match.name })
                : t('matchingSubagent', { agent: match.name }),
          teammates: matching.map((mate) => mate.key).join('\0'),
          teammateNote:
            first === undefined ? null : t('matchingTeammate', { agent: teammateName(first).name })
        }
      }),
    [rows, query, t]
  )

  return (
    <Card as="section" labelledBy={titleId} className={styles.list}>
      <div className={styles.titleRow}>
        <h2 id={titleId} className={styles.title}>
          {t('listTitle')}
        </h2>
        {matchCount !== null && (
          <MutedText as="span" decorative>
            {t('search.count', { count: matchCount })}
          </MutedText>
        )}
        <AgentLegend kinds={kinds} />
      </div>
      <div className={styles.scroller}>
        <div className={styles.table}>
          <CardColumns className={styles.header} decorative>
            <span>{t('columns.session')}</span>
            <span>{t('columns.agents')}</span>
            <span>{t('columns.duration')}</span>
            <span />
            <span className={styles.right}>{t('columns.tokens')}</span>
            <span className={styles.right}>{t('columns.price')}</span>
          </CardColumns>
          <ol className={styles.cards} aria-labelledby={labelledBy}>
            {cards.map(({ row, reasons }, index) => (
              <SessionCard
                key={row.key}
                row={row}
                selectedDirName={selectedDirName}
                matchedTeammates={matches[index]?.teammates ?? ''}
                largestTokens={largestTokens}
                partial={reasons.size > 0}
                matchNote={matches[index]?.note ?? null}
                teammateNote={matches[index]?.teammateNote ?? null}
              />
            ))}
          </ol>
        </div>
      </div>
      <div className={styles.notes}>
        <PartialFootnote reasons={allReasons} />
        <SignalScopeNote rows={rows} />
      </div>
    </Card>
  )
})
