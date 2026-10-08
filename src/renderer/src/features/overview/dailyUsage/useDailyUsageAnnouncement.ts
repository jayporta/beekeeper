import { useTranslation } from 'react-i18next'
import { useSettledAnnouncement } from '@renderer/components/useSettledAnnouncement'
import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'

/** What the window's daily usage came to once it settled: figures, figures that may be low, or nothing that could be loaded. */
export type DailyUsageOutcome = 'updated' | 'partial' | 'failed'

/** What {@link useDailyUsageAnnouncement} reports on. */
interface DailyUsageAnnouncementInput {
  /** The window the usage covers. */
  readonly range: TotalsWindowDto
  /** Whether every folder's usage for the window has arrived, with none showing a previous window's or day's. */
  readonly settled: boolean
  /** What the usage came to. */
  readonly outcome: DailyUsageOutcome
}

/**
 * The text for the tokens per day section's status region: once the window's
 * usage has all arrived, that it did (and whether some days may be low), or
 * that none could be loaded. It says it once per arrival, not per folder, for
 * the first load, after each change of window, and after the day changes.
 *
 * @param input - The window, whether its usage has settled, and what it came to.
 * @returns The text to show in the region. It is empty until there is news, and again after the hidden live copy's clear delay.
 */
export function useDailyUsageAnnouncement({
  range,
  settled,
  outcome
}: DailyUsageAnnouncementInput): string {
  const { t } = useTranslation('overview')

  return useSettledAnnouncement({
    scope: range,
    settled,
    outcome,
    say: (spoken, window) => t(`dailyUsage.announce.${spoken}`, { range: t(`range.${window}`) })
  })
}
