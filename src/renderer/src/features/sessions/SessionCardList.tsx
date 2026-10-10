import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CapsText } from '@renderer/components/CapsText'
import { AgentLegend } from './AgentLegend'
import { agentMarks, type AgentMarkKind } from './agentMarks'
import { CardColumns } from './CardColumns'
import { matchOf } from './sessionMatches'
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
  /** The search text from `normalizeQuery`, or `''` when no search is active. It highlights the chips that match and names the workflow or subagent a card matches only through. */
  readonly query: string
}

/**
 * The sessions as a list of cards under a column header row, then a legend
 * for the agent marks on screen, a footnote for any partial figure or any
 * signal count marked partial, and a note on what the signal counts cover.
 * The header row is visual only: each card says what its figures are in
 * words. It is memoized so a keystroke in the search box skips it until the
 * deferred filter catches up.
 *
 * @example
 * <SessionCardList rows={rows} labelledBy={headingId} selectedDirName="-Users-me-repo" query="" />
 */
export const SessionCardList = memo(function SessionCardList({
  rows,
  labelledBy,
  selectedDirName,
  query
}: SessionCardListProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const cards = useMemo(() => rows.map((row) => ({ row, reasons: partialReasons(row) })), [rows])
  const allReasons = useMemo(() => {
    const reasons = new Set<PartialReason>(cards.flatMap(({ reasons }) => [...reasons]))
    if (rows.some(({ item }) => signalsMarked(signalTotalsOf(item)))) {
      reasons.add('incompleteSignals')
    }
    return reasons
  }, [cards, rows])
  const kinds = useMemo(() => kindsDrawn(rows), [rows])
  // Worked out here, as a string or `null`, so a card without chips re-renders only when its note changes.
  const matchNotes = useMemo(
    () =>
      rows.map((row) => {
        const match = matchOf(row, query)
        if (match === null) return null
        return match.kind === 'workflow'
          ? t('matchingWorkflow', { workflow: match.name })
          : t('matchingSubagent', { agent: match.name })
      }),
    [rows, query, t]
  )

  return (
    <div className={styles.list}>
      <CardColumns className={styles.header} decorative>
        <CapsText as="span">{t('columns.session')}</CapsText>
        <CapsText as="span">{t('columns.agents')}</CapsText>
        <CapsText as="span">{t('columns.duration')}</CapsText>
        <CapsText as="span" className={styles.right}>
          {t('columns.tokens')}
        </CapsText>
      </CardColumns>
      <ol className={styles.cards} aria-labelledby={labelledBy}>
        {cards.map(({ row, reasons }, index) => (
          <SessionCard
            key={row.key}
            row={row}
            selectedDirName={selectedDirName}
            needle={row.teammates.length > 0 ? query : ''}
            partial={reasons.size > 0}
            matchNote={matchNotes[index] ?? null}
          />
        ))}
      </ol>
      <div className={styles.notes}>
        <AgentLegend kinds={kinds} />
        <PartialFootnote reasons={allReasons} />
        <SignalScopeNote rows={rows} />
      </div>
    </div>
  )
})
