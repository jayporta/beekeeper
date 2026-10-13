import { useTranslation } from 'react-i18next'
import { StatRowItem } from '@renderer/components/StatRowItem'
import { EmptyCell } from '@renderer/features/sessions/EmptyCell'
import { formatUsd } from '@renderer/i18n/formatUsd'
import type { ReportCost } from './reportCost'

/** Props for {@link InspectorCostStat}. */
interface InspectorCostStatProps {
  /** The cost at API prices. */
  readonly cost: ReportCost
  /** Whether the usage the cost is drawn from may be incomplete, which marks the cost even when every group is priced. */
  readonly usageIncomplete: boolean
}

/**
 * The stat grid's item for an agent's or a run's cost at API prices, which
 * says it isn't recorded when it isn't. A cost that may be low carries a "¹".
 *
 * @example
 * <InspectorCostStat cost={{ usd: 0.4, partial: false }} usageIncomplete={false} />
 */
export function InspectorCostStat({
  cost,
  usageIncomplete
}: InspectorCostStatProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')
  const { t: tSessions } = useTranslation('sessions')
  const usd = formatUsd(cost.usd, tSessions)
  const label = tSessions('stats.cost')
  const noCostText = tSessions('emptyCell.costNotRecorded')

  return (
    <StatRowItem
      label={label}
      partialNote={cost.partial || usageIncomplete ? t('partial.note') : undefined}
    >
      {usd ?? <EmptyCell spokenText={noCostText} />}
    </StatRowItem>
  )
}
