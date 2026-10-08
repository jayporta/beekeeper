import { memo, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'
import styles from './DailyUsageTable.module.css'
import { dayLabels } from './dayLabels'
import { seriesLabel } from './seriesLabel'
import { seriesTokens, type Series } from './seriesOf'
import type { DailyUsageDay } from './sumDailyUsage'

/** Props for {@link DailyUsageTable}. */
interface DailyUsageTableProps {
  /** The window's days, oldest first. */
  readonly days: readonly DailyUsageDay[]
  /** The tokens over every day, from the summary. */
  readonly total: number
  /** The chart's series, from `seriesOf`. */
  readonly series: readonly Series[]
  /** The window the days cover, to name the table. */
  readonly range: TotalsWindowDto
}

/**
 * The chart's figures as a table, in a labelled region the keyboard can scroll
 * sideways when it is wider than the space it has. It renders again only when
 * its props change, since it formats a label for every cell: a row for each day, a column for each
 * series and the day's total, and a row of totals. Numbers are exact, unlike
 * the chart's compact axis.
 *
 * @example
 * <DailyUsageTable days={summary.days} total={summary.total} series={seriesOf(summary.days)} range="7d" />
 */
export const DailyUsageTable = memo(function DailyUsageTable({
  days,
  total,
  series,
  range
}: DailyUsageTableProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const otherModels = t('dailyUsage.otherModels')
  const exact = (value: number): string => t('dailyUsage.exact', { value })
  const captionId = useId()

  return (
    <div role="region" aria-labelledby={captionId} tabIndex={0} className={styles.scroll}>
      <table className={styles.table}>
        <caption id={captionId} className="visuallyHidden">
          {t('dailyUsage.table.caption', { range: t(`range.${range}`) })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('dailyUsage.table.day')}</th>
            {series.map((entry) => (
              <th key={entry.index} scope="col">
                {seriesLabel(entry, otherModels)}
              </th>
            ))}
            <th scope="col">{t('dailyUsage.table.total')}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{dayLabels(t, day.day).full}</th>
              {series.map((entry) => (
                <td key={entry.index}>
                  {exact(seriesTokens({ day, series: entry, all: series }))}
                </td>
              ))}
              <td>{exact(day.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('dailyUsage.table.total')}</th>
            {series.map((entry) => (
              <td key={entry.index}>{exact(entry.total)}</td>
            ))}
            <td>{exact(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
})
