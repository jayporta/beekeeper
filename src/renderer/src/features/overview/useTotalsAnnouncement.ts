import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnouncement } from '@renderer/components/useAnnouncement'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'

/** What {@link useTotalsAnnouncement} reports on. */
interface TotalsAnnouncementInput {
  /** The window the totals cover. */
  readonly range: TotalsWindowDto
  /** Whether every folder's totals for the window have arrived, with none showing the other window's. */
  readonly settled: boolean
  /** Whether the window has no activity, so the overview shows its empty message. */
  readonly empty: boolean
}

/**
 * The text for the overview's status region: once the window's totals have all
 * arrived, that they did, or that the window has no activity. It says it once
 * per arrival, not per folder, for the first load and after each change of
 * window. Totals that were already in when the overview opened say nothing.
 *
 * @param input - The window, whether its totals have settled, and whether it is empty.
 * @returns The text to show in the region. It is empty until there is news, and again after the hidden live copy's clear delay.
 */
export function useTotalsAnnouncement({ range, settled, empty }: TotalsAnnouncementInput): string {
  const { t } = useTranslation('overview')
  const { message, announce } = useAnnouncement()
  const [pending, setPending] = useState(!settled)
  const [announcedRange, setAnnouncedRange] = useState(range)

  if (range !== announcedRange) {
    setAnnouncedRange(range)
    setPending(true)
  } else if (!settled && !pending) {
    setPending(true)
  } else if (settled && pending) {
    setPending(false)
    const rangeName = t(`range.${range}`)
    announce(
      empty
        ? t('announce.empty', {
            heading: t('empty.heading'),
            body: t(`empty.body.${range}`, { range: rangeName })
          })
        : t('announce.updated', { range: rangeName })
    )
  }
  return message
}
