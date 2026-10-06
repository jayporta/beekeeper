import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnouncement } from '@renderer/components/useAnnouncement'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'

/**
 * What the window's totals came to once they settled: figures, figures that
 * may be low, no activity, or nothing that could be loaded.
 */
export type TotalsOutcome = 'updated' | 'partial' | 'empty' | 'failed'

/** What {@link useTotalsAnnouncement} reports on. */
interface TotalsAnnouncementInput {
  /** The window the totals cover. */
  readonly range: TotalsWindowDto
  /** Whether every folder's totals for the window have arrived, with none showing the other window's. */
  readonly settled: boolean
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
 * @param input - The window, whether its totals have settled, and what they came to.
 * @returns The text to show in the region. It is empty until there is news, and again after the hidden live copy's clear delay.
 */
export function useTotalsAnnouncement({
  range,
  settled,
  outcome
}: TotalsAnnouncementInput): string {
  const { t } = useTranslation('overview')
  const { message, announce } = useAnnouncement()
  const [pending, setPending] = useState(!settled)
  const [announcedRange, setAnnouncedRange] = useState(range)
  const [announcedOutcome, setAnnouncedOutcome] = useState(outcome)

  if (range !== announcedRange) {
    setAnnouncedRange(range)
    setPending(true)
  } else if (!settled && !pending) {
    setPending(true)
  } else if (settled && (pending || outcome !== announcedOutcome)) {
    setPending(false)
    setAnnouncedOutcome(outcome)
    const rangeName = t(`range.${range}`)
    announce(
      outcome === 'empty'
        ? t('announce.empty', {
            heading: t('empty.heading'),
            body: t(`empty.body.${range}`, { range: rangeName })
          })
        : t(`announce.${outcome}`, { range: rangeName })
    )
  }
  return message
}
