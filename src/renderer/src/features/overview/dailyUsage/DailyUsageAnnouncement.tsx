import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'
import { useDailyUsageAnnouncement, type DailyUsageOutcome } from './useDailyUsageAnnouncement'

/** Props for {@link DailyUsageAnnouncement}. */
interface DailyUsageAnnouncementProps {
  /** The window the usage covers. */
  readonly range: TotalsWindowDto
  /** Whether every folder's usage for the window has arrived. */
  readonly settled: boolean
  /** What the usage came to. */
  readonly outcome: DailyUsageOutcome
}

/**
 * The tokens per day section's polite status region, for screen readers that
 * can't see the chart change (WCAG 4.1.3). It is always rendered and empty
 * until the window's usage has arrived, so the region exists before its text
 * changes.
 *
 * @example
 * <DailyUsageAnnouncement range="7d" settled outcome="updated" />
 */
export function DailyUsageAnnouncement({
  range,
  settled,
  outcome
}: DailyUsageAnnouncementProps): React.JSX.Element {
  const message = useDailyUsageAnnouncement({ range, settled, outcome })

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
