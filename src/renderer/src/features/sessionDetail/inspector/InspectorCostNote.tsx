import { useTranslation } from 'react-i18next'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import { formatUsd } from '@renderer/i18n/formatUsd'
import { InspectorMarker } from './InspectorMarker'
import { InspectorNote } from './InspectorNote'
import type { ReportCost } from './reportCost'

/** Props for {@link InspectorCostNote}. */
interface InspectorCostNoteProps {
  /** The cost at API prices. */
  readonly cost: ReportCost
  /** Whether the usage the cost is drawn from may be incomplete, which marks the cost even when every group is priced. */
  readonly usageIncomplete: boolean
}

/**
 * The line that gives an agent's or a run's cost at API prices, or says it
 * isn't recorded. A cost that may be low carries a "¹".
 *
 * @example
 * <InspectorCostNote cost={{ usd: 0.4, partial: false }} usageIncomplete={false} />
 */
export function InspectorCostNote({
  cost,
  usageIncomplete
}: InspectorCostNoteProps): React.JSX.Element {
  const { t: tSessions } = useTranslation('sessions')
  const usd = formatUsd(cost.usd, tSessions)
  const costText = usd === null ? null : tSessions('apiCost', { value: usd })
  const noCostText = tSessions('emptyCell.costNotRecorded')

  return (
    <InspectorNote>
      {costText ?? <EmptyCell spokenText={noCostText} />}
      {(cost.partial || usageIncomplete) && <InspectorMarker />}
    </InspectorNote>
  )
}
