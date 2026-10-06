import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'
import { useTotalsAnnouncement, type TotalsOutcome } from './useTotalsAnnouncement'

/** Props for {@link TotalsAnnouncement}. */
interface TotalsAnnouncementProps {
  /** The window the totals cover. */
  readonly range: TotalsWindowDto
  /** Whether every folder's totals for the window have arrived. */
  readonly settled: boolean
  /** What the totals came to: figures, figures that may be low, no activity, or every project failed. */
  readonly outcome: TotalsOutcome
}

/**
 * The overview's polite status region, for screen readers that can't see the
 * figures change (WCAG 4.1.3). It is always rendered and empty until the
 * window's totals have arrived, so the region exists before its text changes.
 * It speaks again when the outcome changes while settled.
 *
 * @example
 * <TotalsAnnouncement range="7d" settled outcome="updated" />
 */
export function TotalsAnnouncement({
  range,
  settled,
  outcome
}: TotalsAnnouncementProps): React.JSX.Element {
  const message = useTotalsAnnouncement({ range, settled, outcome })

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
