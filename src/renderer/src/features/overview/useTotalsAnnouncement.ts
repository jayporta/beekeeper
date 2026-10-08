import { useTranslation } from 'react-i18next'
import { useSettledAnnouncement } from '@renderer/components/useSettledAnnouncement'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'

/**
 * What the window's totals came to once they settled: figures, figures that
 * may be low, no activity, or nothing that could be loaded.
 */
export type TotalsOutcome = 'updated' | 'partial' | 'empty' | 'failed'

/** What the tokens per day section adds to the announcement: nothing, that they may be low, or that they couldn't be loaded. */
export type DailyAnnouncement = 'none' | 'partial' | 'failed'

/** What {@link useTotalsAnnouncement} reports on. */
interface TotalsAnnouncementInput {
  /** The window the totals cover. */
  readonly range: TotalsWindowDto
  /** Whether every folder's totals for the window have arrived, with none showing the other window's, and the tokens per day too when the section is shown. */
  readonly settled: boolean
  /** What the tokens per day came to, to add to the message, or `none` when there is nothing to add: they updated, or the section isn't shown. */
  readonly daily: DailyAnnouncement
  /** What the totals came to: figures, figures that may be low, no activity (the overview shows its empty message), or every project failed. */
  readonly outcome: TotalsOutcome
}

/**
 * The text for the overview's status region: once the window's totals have all
 * arrived, that they did (and whether some figures may be low), that the window
 * has no activity, or that none could be loaded. It says it once per arrival,
 * not per folder, for the first load and after each change of window. Once
 * settled it also says so when the outcome changes, such as totals that load
 * after a failure, and says nothing for a refresh that leaves the outcome as
 * it was. Totals that were already in when the overview opened say nothing.
 *
 * The tokens per day add a sentence when they may be low or couldn't be loaded.
 *
 * @param input - The window, whether its data has settled, and what it came to.
 * @returns The text to show in the region. It is empty until there is news, and again after the hidden live copy's clear delay.
 */
export function useTotalsAnnouncement({
  range,
  settled,
  outcome,
  daily
}: TotalsAnnouncementInput): string {
  const { t } = useTranslation('overview')

  return useSettledAnnouncement({
    scope: range,
    settled,
    // Both parts, so a change in either is news.
    outcome: `${outcome}:${daily}`,
    say: (_spoken, window) => {
      const rangeName = t(`range.${window}`)
      const totals =
        outcome === 'empty'
          ? t('announce.empty', {
              heading: t('empty.heading'),
              body: t(`empty.body.${window}`, { range: rangeName })
            })
          : t(`announce.${outcome}`, { range: rangeName })
      return daily === 'none'
        ? totals
        : t('announce.withDaily', { totals, daily: t(`announce.daily.${daily}`) })
    }
  })
}
