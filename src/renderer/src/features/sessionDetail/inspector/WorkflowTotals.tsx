import { useTranslation } from 'react-i18next'
import { MutedText } from '@renderer/components/MutedText'
import { InspectorCostNote } from './InspectorCostNote'
import { InspectorTotalsFrame } from './InspectorTotalsFrame'
import type { ReportCost } from './reportCost'

/** Props for {@link WorkflowTotals}. */
interface WorkflowTotalsProps {
  /** The run's tokens: its agents' added up, or `null` when none has any recorded. */
  readonly tokens: number | null
  /** Whether the tokens may be low: an agent's report is unreadable, skipped lines, or has no tokens recorded. */
  readonly partial: boolean
  /** How many agents ran in the run. */
  readonly agents: number
  /** The run's cost at API prices. */
  readonly cost: ReportCost
}

/**
 * A workflow run's totals: its tokens in large type, how many agents ran in
 * it, then its cost at API prices. A run's tokens are its agents', so there is
 * no separate own and below. A figure that may be low carries a "¹".
 *
 * @example
 * <WorkflowTotals tokens={30} partial={false} agents={2} cost={{ usd: 5, partial: false }} />
 */
export function WorkflowTotals({
  tokens,
  partial,
  agents,
  cost
}: WorkflowTotalsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <InspectorTotalsFrame tokens={tokens} partial={partial}>
      <MutedText>{t('inspector.workflow.agents', { count: agents })}</MutedText>
      <InspectorCostNote cost={cost} usageIncomplete={partial} />
    </InspectorTotalsFrame>
  )
}
