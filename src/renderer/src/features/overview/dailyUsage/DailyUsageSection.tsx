import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Footnote } from '@renderer/components/Footnote'
import { MutedText } from '@renderer/components/MutedText'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { DailyUsageAnnouncement } from './DailyUsageAnnouncement'
import { DailyUsageChart } from './DailyUsageChart'
import { dailyUsageReasonsOf } from './dailyUsageReasons'
import styles from './DailyUsageSection.module.css'
import { DailyUsageLegend } from './DailyUsageLegend'
import { DailyUsageTable } from './DailyUsageTable'
import { seriesOf } from './seriesOf'
import type { DailyUsageOutcome } from './useDailyUsageAnnouncement'
import { useDailyUsage } from './useDailyUsage'

/** The id of the section's footnote. */
const FOOTNOTE_ID = 'daily-usage-footnote'

/**
 * The overview's tokens per day section: a stacked bar chart by model for the
 * chosen window, a note that tokens count on the day each message ran, a
 * button that opens the same figures as a table, and a note on any day that
 * may be low. While any folder loads, or the figures are the previous
 * window's or day's, the section is busy; those figures stay on screen, at
 * full contrast, with an "Updating" note. A status region announces once when
 * the window's usage has arrived, or could not be loaded. With every folder failed, the error replaces the chart.
 *
 * @example
 * <DailyUsageSection />
 */
export function DailyUsageSection(): React.JSX.Element {
  const { t } = useTranslation('overview')
  const { window: range, summary } = useDailyUsage()
  const [tableOpen, setTableOpen] = useState(false)
  const headingId = useId()
  const tableId = useId()
  const series = useMemo(() => seriesOf(summary.days), [summary.days])
  const reasons = dailyUsageReasonsOf(summary)
  const hasDays = summary.days.length > 0
  const failedOutright = !hasDays && summary.failed > 0 && summary.loading === 0
  const busy = summary.loading > 0 || summary.refreshing || (!hasDays && !failedOutright)
  let outcome: DailyUsageOutcome = 'updated'
  if (failedOutright) outcome = 'failed'
  else if (reasons.length > 0) outcome = 'partial'

  return (
    <section className={styles.section} aria-labelledby={headingId} aria-busy={busy}>
      <DailyUsageAnnouncement range={range} settled={!busy} outcome={outcome} />
      <h2 id={headingId} className={styles.heading}>
        {t('dailyUsage.heading')}
      </h2>
      {hasDays && (
        <>
          <DailyUsageLegend series={series} />
          <DailyUsageChart
            days={summary.days}
            total={summary.total}
            series={series}
            range={range}
          />
          <MutedText>
            {t('dailyUsage.note')}
            {reasons.length > 0 && <PartialMarker note={t('dailyUsage.partialNote')} />}
          </MutedText>
          {summary.refreshing && <MutedText>{t('updating')}</MutedText>}
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={tableOpen}
            aria-controls={tableId}
            onClick={() => {
              setTableOpen((open) => !open)
            }}
          >
            {t('dailyUsage.tableToggle')}
          </button>
          <div id={tableId} hidden={!tableOpen}>
            {tableOpen && (
              <DailyUsageTable
                days={summary.days}
                total={summary.total}
                series={series}
                range={range}
              />
            )}
          </div>
          {reasons.length > 0 && (
            <Footnote
              id={FOOTNOTE_ID}
              label={t('dailyUsage.footnote.label')}
              sentences={[
                ...reasons.map((reason) => t(`dailyUsage.footnote.${reason}`)),
                t('dailyUsage.footnote.mayBeLow')
              ]}
            />
          )}
        </>
      )}
      {!hasDays && !failedOutright && <MutedText>{t('dailyUsage.loading')}</MutedText>}
      {failedOutright && <MutedText>{t('dailyUsage.error')}</MutedText>}
    </section>
  )
}
