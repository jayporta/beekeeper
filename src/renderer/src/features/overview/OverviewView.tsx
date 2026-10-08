import { useTranslation } from 'react-i18next'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { DailyUsageSection } from './dailyUsage/DailyUsageSection'
import { dailyUsageStatusOf } from './dailyUsage/dailyUsageStatus'
import { useDailyUsage } from './dailyUsage/useDailyUsage'
import { OverviewFootnote } from './OverviewFootnote'
import { OverviewHeader } from './OverviewHeader'
import styles from './OverviewView.module.css'
import { partialReasonsOf } from './partialReasons'
import { ProjectCard } from './ProjectCard'
import { shareOfLargest } from './shareOfLargest'
import { totalsStatus } from './sumTotals'
import { TotalsAnnouncement } from './TotalsAnnouncement'
import { TotalsStrip } from './TotalsStrip'
import type { DailyAnnouncement, TotalsOutcome } from './useTotalsAnnouncement'
import { useProjectGroupTotals } from './useProjectGroupTotals'

/**
 * The all-projects overview: a header with the 7 or 30 day window, the totals
 * across every project, a card for each project, and a note on any figure
 * that may be low. Each project loads on its own, so a card fills in as its
 * totals arrive and a project that can't be read doesn't hold up the rest.
 * With nothing in the window, no tokens per day, and no session it couldn't read,
 * it says so, above cards that show zero. While a window's totals load, or show
 * the other window's until they arrive, the cards are marked busy. The empty
 * message and the announcement also wait for the tokens per day. A status region announces once
 * when the window's totals have all arrived (noting when some may be low), that
 * the window is empty, or that none could be loaded, and again if that outcome
 * later changes. Under the totals, unless the window is empty, a chart shows
 * the tokens per day by model.
 *
 * @example
 * <main><OverviewView /></main>
 */
export function OverviewView(): React.JSX.Element {
  const { t } = useTranslation('overview')
  const { window: range, items: cards, overall } = useProjectGroupTotals()
  const dailyUsage = useDailyUsage()

  const largest = Math.max(
    0,
    ...cards.map(({ totals }) => (totalsStatus(totals) === 'ready' ? totals.tokens : 0))
  )
  const { folders } = overall
  const settled = folders.loading === 0 && !overall.refreshing
  const idle =
    settled &&
    folders.failed === 0 &&
    overall.partial.unreadable === 0 &&
    overall.tokens === 0 &&
    overall.sessions === 0 &&
    overall.agents === 0
  const reasons = partialReasonsOf(overall)
  const daily = dailyUsageStatusOf(dailyUsage.summary)
  // Idle totals are empty only once tokens per day have settled with none, since the days may hold
  // what the totals missed. With no project listed there are no days to wait for.
  const dailyDone = daily.settled || cards.length === 0
  const empty = idle && dailyDone && dailyUsage.summary.total === 0
  // The section is shown unless the window is empty, and only then does its usage count.
  let dailyAnnouncement: DailyAnnouncement = 'none'
  if (!empty && daily.outcome !== 'updated') dailyAnnouncement = daily.outcome
  let outcome: TotalsOutcome = 'updated'
  if (totalsStatus(overall) === 'error') outcome = 'failed'
  else if (empty) outcome = 'empty'
  else if (reasons.length > 0) outcome = 'partial'

  return (
    <div className={styles.view}>
      <OverviewHeader />
      <TotalsAnnouncement
        range={range}
        settled={settled && dailyDone}
        outcome={outcome}
        daily={dailyAnnouncement}
      />
      {cards.length > 0 && <TotalsStrip totals={overall} range={range} />}
      {!empty && <DailyUsageSection usage={dailyUsage} />}
      {empty && (
        <StatusMessage
          headingLevel={2}
          heading={t('empty.heading')}
          body={t(`empty.body.${range}`, { range: t(`range.${range}`) })}
        />
      )}
      <ul className={styles.cards} aria-busy={!settled}>
        {cards.map(({ group, totals }) => (
          <ProjectCard
            key={group.project.dirName}
            group={group}
            totals={totals}
            share={shareOfLargest(totals.tokens, largest)}
          />
        ))}
      </ul>
      <OverviewFootnote reasons={reasons} />
    </div>
  )
}
