import { useTranslation } from 'react-i18next'
import { EmptyCell, type EmptyReason } from './EmptyCell'
import { formatTokens } from './formatTokens'
import { formatUsd } from './formatUsd'
import type { UsageFigures } from './sessionUsage'
import styles from './UsageCell.module.css'

/** Props for {@link UsageCell}. */
interface UsageCellProps {
  /** The figures to show, or `null` for an empty cell. */
  readonly figures: UsageFigures | null
  /**
   * Why the cell is empty, when `figures` is `null`.
   * @defaultValue 'not-recorded'
   */
  readonly emptyReason?: EmptyReason
}

/**
 * A table data cell holding a token figure as its main line and the
 * API-priced cost as a muted second line. A session's token figure is its
 * recorded total, or its transcript's total when it recorded none. Each line that leaves something out
 * carries a muted `partial` note, and a line with no value shows an empty
 * marker that names what is missing. When neither value is known, or there
 * are no figures, the cell shows a single empty marker.
 *
 * @example
 * <UsageCell figures={{ tokens: 12_400_000, usd: 3.2, tokensPartial: false, usdPartial: true }} />
 */
export function UsageCell({ figures, emptyReason }: UsageCellProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  if (figures === null || (figures.tokens === null && figures.usd === null)) {
    return (
      <td className={styles.cell}>
        <EmptyCell {...(emptyReason !== undefined && { reason: emptyReason })} />
      </td>
    )
  }

  const tokens = formatTokens(figures.tokens, t)
  const usd = formatUsd(figures.usd, t)
  const partial = (
    <>
      {' '}
      <span className={styles.note}>{t('partial')}</span>
    </>
  )

  return (
    <td className={styles.cell}>
      <span className={styles.line}>
        {tokens ?? <EmptyCell spokenText={t('emptyCell.tokensNotRecorded')} />}
        {figures.tokensPartial && partial}
      </span>{' '}
      <span className={`${styles.line} ${styles.muted}`}>
        {usd === null ? (
          <EmptyCell spokenText={t('emptyCell.costNotRecorded')} />
        ) : (
          t('apiCost', { value: usd })
        )}
        {figures.usdPartial && partial}
      </span>
    </td>
  )
}
