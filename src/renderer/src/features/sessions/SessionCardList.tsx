import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import columns from './CardColumns.module.css'
import { PartialFootnote } from './PartialFootnote'
import { partialReasons, type PartialReason } from './partialReasons'
import { SessionCard } from './SessionCard'
import styles from './SessionCardList.module.css'
import type { SessionRow } from './sessionRow'

/** Props for {@link SessionCardList}. */
interface SessionCardListProps {
  /** The top-level rows to show, already filtered. */
  readonly rows: readonly SessionRow[]
  /** The id of the heading that names the list. */
  readonly labelledBy: string
  /** The folder the list is for. */
  readonly selectedDirName: string
  /** The search text from `normalizeQuery`, or `''` when no search is active. It highlights the chips that match. */
  readonly query: string
}

/**
 * The sessions as a list of cards under a column header row, then a footnote
 * for any partial figure. The header row is visual only: each card says what
 * its figures are in words. It is memoized so a keystroke in the search box
 * skips it until the deferred filter catches up.
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
  const allReasons = useMemo(
    () => new Set<PartialReason>(cards.flatMap(({ reasons }) => [...reasons])),
    [cards]
  )

  return (
    <div className={styles.list}>
      <div className={`${columns.columns} ${styles.header}`} aria-hidden="true">
        <span>{t('columns.session')}</span>
        <span>{t('columns.agents')}</span>
        <span>{t('columns.duration')}</span>
        <span className={styles.right}>{t('columns.tokens')}</span>
      </div>
      <ol className={styles.cards} aria-labelledby={labelledBy}>
        {cards.map(({ row, reasons }) => (
          <SessionCard
            key={row.key}
            row={row}
            selectedDirName={selectedDirName}
            needle={query}
            reasons={reasons}
          />
        ))}
      </ol>
      <PartialFootnote reasons={allReasons} />
    </div>
  )
})
