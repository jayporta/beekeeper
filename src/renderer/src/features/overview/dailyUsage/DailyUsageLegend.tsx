import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './DailyUsageLegend.module.css'
import { seriesLabel } from './seriesLabel'
import type { Series } from './seriesOf'
import { SeriesFill } from './SeriesFill'

/** Props for {@link DailyUsageLegend}. */
interface DailyUsageLegendProps {
  /** The chart's series. Nothing renders when it is empty. */
  readonly series: readonly Series[]
}

/**
 * The chart's key: each series' color beside its model id, or "Other models".
 * A long model id wraps.
 *
 * @example
 * <DailyUsageLegend series={seriesOf(days)} />
 */
export const DailyUsageLegend = memo(function DailyUsageLegend({
  series
}: DailyUsageLegendProps): React.JSX.Element | null {
  const { t } = useTranslation('overview')
  if (series.length === 0) return null

  return (
    <ul className={styles.legend} aria-label={t('dailyUsage.legendLabel')}>
      {series.map((entry) => (
        <li key={entry.index} className={styles.item}>
          <SeriesFill index={entry.index} className={styles.swatch} />
          <span>{seriesLabel(entry, t('dailyUsage.otherModels'))}</span>
        </li>
      ))}
    </ul>
  )
})
