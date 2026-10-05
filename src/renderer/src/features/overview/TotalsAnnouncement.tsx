import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'
import { useTotalsAnnouncement } from './useTotalsAnnouncement'

/** Props for {@link TotalsAnnouncement}. */
interface TotalsAnnouncementProps {
  /** The window the totals cover. */
  readonly range: TotalsWindowDto
  /** Whether every folder's totals for the window have arrived. */
  readonly settled: boolean
  /** Whether the window has no activity. */
  readonly empty: boolean
}

/**
 * The overview's polite status region, for screen readers that can't see the
 * figures change (WCAG 4.1.3). It is always rendered and empty until the
 * window's totals have arrived, so the region exists before its text changes.
 *
 * @example
 * <TotalsAnnouncement range="7d" settled empty={false} />
 */
export function TotalsAnnouncement({
  range,
  settled,
  empty
}: TotalsAnnouncementProps): React.JSX.Element {
  const message = useTotalsAnnouncement({ range, settled, empty })

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
