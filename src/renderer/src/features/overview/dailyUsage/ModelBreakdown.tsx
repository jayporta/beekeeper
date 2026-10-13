import { useTranslation } from 'react-i18next'
import type { ModelShare } from './byModelTotals'
import styles from './ModelBreakdown.module.css'
import { seriesLabel } from './seriesLabel'
import { SeriesFill } from './SeriesFill'

/** Props for {@link ModelBreakdown}. */
interface ModelBreakdownProps {
  /** Each family's share, from `byModelTotals`. */
  readonly rows: readonly ModelShare[]
}

/**
 * A row for each model family: its swatch, name, compact tokens, and percent
 * of the window's tokens ("<1%" for a family under one percent). The rows carry
 * the figures the ring beside them only draws.
 *
 * @example
 * <ModelBreakdown rows={byModelTotals(series, total)} />
 */
export function ModelBreakdown({ rows }: ModelBreakdownProps): React.JSX.Element {
  const { t } = useTranslation('overview')

  return (
    <ul className={styles.rows} aria-label={t('byModel.label')}>
      {rows.map((row) => (
        <li key={row.key} className={styles.row}>
          <SeriesFill family={row.key} className={styles.swatch} />
          <span className={styles.name}>{seriesLabel(row, t)}</span>
          <span className={styles.figure}>{t('dailyUsage.figure', { value: row.tokens })}</span>
          <span className={styles.figure}>
            {row.underOne ? t('byModel.underOne') : t('percent', { value: row.percent })}
          </span>
        </li>
      ))}
    </ul>
  )
}
