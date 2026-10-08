import { useTranslation } from 'react-i18next'
import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'
import { chartScale } from './chartScale'
import styles from './DailyUsageChart.module.css'
import { dayLabels } from './dayLabels'
import { seriesLabel } from './seriesLabel'
import { seriesTokens, type Series } from './seriesOf'
import { SeriesFill } from './SeriesFill'
import type { DailyUsageDay } from './sumDailyUsage'

/** How many days apart the 30 day chart labels its days, counting back from the last. */
const LABEL_EVERY_DAYS = 5

/** Props for {@link DailyUsageChart}. */
interface DailyUsageChartProps {
  /** The window's days, oldest first. */
  readonly days: readonly DailyUsageDay[]
  /** The chart's series, from `seriesOf`. */
  readonly series: readonly Series[]
  /** The window the days cover, to name the chart. */
  readonly range: TotalsWindowDto
}

/**
 * A stacked bar chart of tokens per day, one bar per day with a segment for
 * each model, drawn in HTML and CSS so its text stays crisp at any width. It
 * is an image named by its range, total and busiest day; the table beside it
 * gives every figure. Each segment has a tooltip with its exact figure for
 * pointer users.
 *
 * @example
 * <DailyUsageChart days={summary.days} series={seriesOf(summary.days)} range="7d" />
 */
export function DailyUsageChart({ days, series, range }: DailyUsageChartProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const scale = chartScale(Math.max(0, ...days.map((day) => day.total)))
  const total = days.reduce((sum, day) => sum + day.total, 0)
  const busiest = days.reduce<DailyUsageDay | undefined>(
    (best, day) => (best === undefined || day.total > best.total ? day : best),
    undefined
  )
  const rangeName = t(`range.${range}`)
  const label =
    busiest === undefined || total === 0
      ? t('dailyUsage.chartLabelEmpty', { range: rangeName })
      : t('dailyUsage.chartLabel', {
          range: rangeName,
          total,
          busiestDay: dayLabels(t, busiest.day).full,
          busiestTotal: busiest.total
        })
  const otherModels = t('dailyUsage.otherModels')
  const weekly = days.length <= 7
  const labelled = days.map((day) => ({ day, labels: dayLabels(t, day.day) }))

  return (
    <div className={styles.chart} role="img" aria-label={label}>
      <div className={styles.axis}>
        {[...scale.ticks].reverse().map((tick) => (
          <span key={tick} className={styles.tick}>
            {t('dailyUsage.figure', { value: tick })}
          </span>
        ))}
      </div>
      <div className={styles.plot}>
        <div className={styles.gridlines}>
          {scale.ticks.map((tick) => (
            <span key={tick} className={styles.gridline} />
          ))}
        </div>
        <div className={styles.columns}>
          {labelled.map(({ day, labels }) => (
            <div key={day.day} className={styles.column}>
              {day.total > 0 && (
                <div
                  className={styles.stack}
                  style={{ blockSize: `${(day.total / scale.top) * 100}%` }}
                >
                  {series.map((entry) => {
                    const tokens = seriesTokens({ day, series: entry, all: series })
                    return tokens > 0 ? (
                      <SeriesFill
                        key={entry.index}
                        index={entry.index}
                        grow={tokens}
                        title={t('dailyUsage.segmentTitle', {
                          day: labels.full,
                          series: seriesLabel(entry, otherModels),
                          value: tokens
                        })}
                      />
                    ) : null
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.days}>
        {labelled.map(({ day, labels }, index) => {
          const shown = weekly || (days.length - 1 - index) % LABEL_EVERY_DAYS === 0
          return (
            <span key={day.day} className={styles.dayLabel}>
              {shown && (
                <>
                  {weekly && <span>{labels.weekday}</span>}
                  <span>{labels.date}</span>
                </>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
